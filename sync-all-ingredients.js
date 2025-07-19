const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function syncAllIngredients(options = {}) {
  console.log('🚀 Syncing ALL 563 ingredients to Monday board...\n');
  
  const { dryRun = false, batchSize = 10, startFrom = 0 } = options;
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const ingredientsBoardId = process.env.INGREDIENTS_BOARD_ID;
    
    // Get all ingredients from database
    console.log('📊 Fetching ALL ingredients from database...');
    
    const ingredientsQuery = `
      SELECT 
        i.id,
        i.name,
        i.inci_name,
        i.supplier_code,
        i.category,
        COUNT(fi.formula_id) as usage_count,
        i.created_date
      FROM ingredients i
      LEFT JOIN formula_ingredients fi ON i.id = fi.ingredient_id
      GROUP BY i.id, i.name, i.inci_name, i.supplier_code, i.category, i.created_date
      ORDER BY COUNT(fi.formula_id) DESC, i.name
      OFFSET ${startFrom}
    `;
    
    const result = await pool.query(ingredientsQuery);
    console.log(`✅ Found ${result.rows.length} ingredients in database (starting from ${startFrom})`);
    
    // Get existing Monday ingredients to avoid duplicates
    console.log('📋 Getting existing Monday ingredients...');
    
    const existingQuery = `
      query {
        boards(ids: [${ingredientsBoardId}]) {
          items_page(limit: 500) {
            items {
              id
              name
            }
          }
        }
      }
    `;
    
    const existingResponse = await monday.api(existingQuery);
    const existingIngredients = existingResponse.data?.boards?.[0]?.items_page?.items || [];
    const existingNames = new Set(existingIngredients.map(item => item.name.toLowerCase()));
    
    console.log(`📊 Found ${existingIngredients.length} existing ingredients on Monday`);
    
    // Filter out ingredients that already exist
    const newIngredients = result.rows.filter(ing => 
      !existingNames.has(ing.name.toLowerCase()) && ing.name !== 'Task 1'
    );
    
    console.log(`🆕 ${newIngredients.length} new ingredients to add`);
    
    if (dryRun) {
      console.log('\\n📋 PREVIEW - Ingredients that would be added:');
      newIngredients.slice(0, 20).forEach((ing, i) => {
        const inci = ing.inci_name ? ` (${ing.inci_name})` : '';
        console.log(`${i+1}. ${ing.name}${inci} - used in ${ing.usage_count} formulas`);
      });
      if (newIngredients.length > 20) {
        console.log(`... and ${newIngredients.length - 20} more ingredients`);
      }
      return;
    }
    
    // Sync ingredients in batches
    let addedCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < newIngredients.length; i += batchSize) {
      const batch = newIngredients.slice(i, i + batchSize);
      console.log(`\\n📦 Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(newIngredients.length/batchSize)}...`);
      
      for (const ingredient of batch) {
        try {
          // Prepare INCI information
          const inciText = ingredient.inci_name ? 
            `${ingredient.inci_name}\\\\nCategory: ${ingredient.category || 'Unknown'}\\\\nUsed in: ${ingredient.usage_count} formulas\\\\nSupplier: ${ingredient.supplier_code || 'Unknown'}` :
            `Category: ${ingredient.category || 'Unknown'}\\\\nUsed in: ${ingredient.usage_count} formulas\\\\nSupplier: ${ingredient.supplier_code || 'Unknown'}`;
          
          const createMutation = `
            mutation {
              create_item (
                board_id: ${ingredientsBoardId},
                item_name: "${ingredient.name.replace(/"/g, '\\"')}",
                column_values: "{\\"long_text_mkt0t76d\\": \\"${inciText.replace(/"/g, '\\"')}\\"}"
              ) {
                id
                name
              }
            }
          `;
          
          const response = await monday.api(createMutation);
          if (response.data?.create_item) {
            addedCount++;
            console.log(`  ✅ Added: ${ingredient.name} (used in ${ingredient.usage_count} formulas)`);
          } else {
            console.log(`  ⚠️  Issue adding: ${ingredient.name}`);
            errorCount++;
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 300));
          
        } catch (error) {
          console.error(`  ❌ Failed to add ${ingredient.name}: ${error.message}`);
          errorCount++;
        }
      }
      
      console.log(`📊 Batch complete. Added: ${addedCount}, Errors: ${errorCount}`);
      
      // Longer delay between batches
      if (i + batchSize < newIngredients.length) {
        console.log('⏸️  Waiting 3 seconds before next batch...');
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }
    
    console.log(`\\n🎉 Ingredient sync complete!`);
    console.log(`📊 SUMMARY:`);
    console.log(`  • Successfully added: ${addedCount} ingredients`);
    console.log(`  • Errors: ${errorCount}`);
    console.log(`  • Previously existed: ${existingIngredients.length}`);
    console.log(`  • Total expected: ${addedCount + existingIngredients.length}`);
    
    // Final verification
    console.log('\\n🔍 Final verification...');
    const finalCheckResponse = await monday.api(existingQuery);
    const finalCount = finalCheckResponse.data?.boards?.[0]?.items_page?.items?.length || 0;
    console.log(`✅ Final Monday ingredient count: ${finalCount}`);
    
    if (finalCount < 563) {
      console.log(`⚠️  Still missing ${563 - finalCount} ingredients. You may need to run this script again with --start-from ${addedCount + existingIngredients.length - 1}`);
    } else {
      console.log(`🎉 SUCCESS! All ingredients synced to Monday!`);
    }
    
  } catch (error) {
    console.error('❌ Error syncing ingredients:', error.message);
    if (error.response?.data) {
      console.error('API Response:', error.response.data);
    }
  } finally {
    await pool.end();
  }
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      options.dryRun = true;
    } else if (args[i] === '--batch-size' && args[i + 1]) {
      options.batchSize = parseInt(args[i + 1]);
      i++;
    } else if (args[i] === '--start-from' && args[i + 1]) {
      options.startFrom = parseInt(args[i + 1]);
      i++;
    }
  }
  
  if (options.dryRun) {
    console.log('🔍 Running in dry-run mode...');
  }
  
  syncAllIngredients(options);
}

module.exports = { syncAllIngredients };