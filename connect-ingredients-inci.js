const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function connectIngredientsInci(options = {}) {
  console.log('🧬 Connecting ingredients to INCI names on Monday.com...\n');
  
  const { dryRun = false, maxIngredients = 20 } = options;
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const ingredientsBoardId = process.env.INGREDIENTS_BOARD_ID;
    const inciBoardId = process.env.INCI_BOARD_ID;
    
    if (!ingredientsBoardId || !inciBoardId) {
      console.error('❌ Missing board IDs in environment variables');
      return;
    }
    
    // First, check if ingredients board has an INCI names column
    console.log('📋 Checking ingredients board structure...');
    
    const boardStructureQuery = `
      query {
        boards(ids: [${ingredientsBoardId}]) {
          name
          columns {
            id
            title
            type
          }
        }
      }
    `;
    
    const structureResponse = await monday.api(boardStructureQuery);
    const ingredientsBoard = structureResponse.data?.boards?.[0];
    const columns = ingredientsBoard?.columns || [];
    
    console.log(`📊 Ingredients board: ${ingredientsBoard?.name}`);
    console.log(`🏗️  Columns: ${columns.length}`);
    
    const inciColumn = columns.find(col => 
      col.title.toLowerCase().includes('inci') ||
      col.title.toLowerCase().includes('name') && col.id !== 'name'
    );
    
    if (!inciColumn) {
      console.log('❌ No INCI names column found on ingredients board');
      console.log('💡 Need to add a text or dependency column for INCI names');
      
      // Create INCI names column
      console.log('🔧 Creating INCI Names column...');
      
      const createColumnMutation = `
        mutation {
          create_column (
            board_id: ${ingredientsBoardId},
            title: "INCI Names",
            column_type: long_text,
            description: "INCI names for this ingredient"
          ) {
            id
            title
            type
          }
        }
      `;
      
      if (!dryRun) {
        try {
          const columnResponse = await monday.api(createColumnMutation);
          const newColumn = columnResponse.data?.create_column;
          console.log(`✅ Created column: ${newColumn?.title} (${newColumn?.id})`);
          
          // Use the new column
          inciColumnId = newColumn.id;
        } catch (error) {
          console.error(`❌ Failed to create INCI column: ${error.message}`);
          return;
        }
      } else {
        console.log('📋 Would create "INCI Names" long_text column');
        return;
      }
    } else {
      console.log(`✅ Found INCI column: ${inciColumn.title} (${inciColumn.id})`);
      inciColumnId = inciColumn.id;
    }
    
    // Get ingredients with INCI names from database
    console.log('📊 Fetching ingredients with INCI names from database...');
    
    const ingredientsQuery = `
      SELECT 
        i.id,
        i.name as ingredient_name,
        i.inci_name,
        i.category,
        COUNT(fi.formula_id) as usage_count
      FROM ingredients i
      LEFT JOIN formula_ingredients fi ON i.id = fi.ingredient_id
      WHERE i.inci_name IS NOT NULL AND i.inci_name != ''
      GROUP BY i.id, i.name, i.inci_name, i.category
      ORDER BY COUNT(fi.formula_id) DESC
      LIMIT ${maxIngredients * 2}
    `;
    
    const result = await pool.query(ingredientsQuery);
    console.log(`✅ Found ${result.rows.length} ingredients with INCI names`);
    
    // Get Monday ingredients and INCI items
    console.log('📋 Getting Monday board items...');
    
    // Get ingredients from Monday
    const mondayIngredientsQuery = `
      query {
        boards(ids: [${ingredientsBoardId}]) {
          items_page(limit: 500) {
            items {
              id
              name
              column_values(ids: ["${inciColumnId}"]) {
                id
                text
                value
              }
            }
          }
        }
      }
    `;
    
    const ingredientsResponse = await monday.api(mondayIngredientsQuery);
    const mondayIngredients = ingredientsResponse.data?.boards?.[0]?.items_page?.items || [];
    console.log(`📊 Found ${mondayIngredients.length} ingredients on Monday`);
    
    // Get INCI items from Monday
    const inciItemsQuery = `
      query {
        boards(ids: [${inciBoardId}]) {
          items_page(limit: 500) {
            items {
              id
              name
            }
          }
        }
      }
    `;
    
    const inciResponse = await monday.api(inciItemsQuery);
    const mondayInciItems = inciResponse.data?.boards?.[0]?.items_page?.items || [];
    console.log(`🧬 Found ${mondayInciItems.length} INCI items on Monday`);
    
    if (dryRun) {
      console.log('\\n📋 PREVIEW - INCI connections that would be made:');
      result.rows.slice(0, 10).forEach(ingredient => {
        console.log(`🧪 ${ingredient.ingredient_name}:`);
        console.log(`  └ INCI: ${ingredient.inci_name}`);
        console.log(`  └ Used in: ${ingredient.usage_count} formulas`);
        console.log(`  └ Category: ${ingredient.category || 'Unknown'}`);
        console.log('');
      });
      return;
    }
    
    // Process each ingredient
    let updatedCount = 0;
    let inciCreatedCount = 0;
    
    for (const ingredient of result.rows.slice(0, maxIngredients)) {
      // Find matching Monday ingredient
      const mondayIngredient = mondayIngredients.find(mi => 
        mi.name.toLowerCase().includes(ingredient.ingredient_name.toLowerCase()) ||
        ingredient.ingredient_name.toLowerCase().includes(mi.name.toLowerCase())
      );
      
      if (!mondayIngredient) {
        console.log(`⚠️  No Monday item found for ingredient: ${ingredient.ingredient_name}`);
        continue;
      }
      
      // Check if already has INCI data
      const currentInciColumn = mondayIngredient.column_values.find(cv => cv.id === inciColumnId);
      if (currentInciColumn && currentInciColumn.text && currentInciColumn.text.trim() !== '') {
        console.log(`⏭️  ${ingredient.ingredient_name} already has INCI data`);
        continue;
      }
      
      console.log(`\\n🔗 Processing: ${ingredient.ingredient_name}`);
      console.log(`  🧬 INCI: ${ingredient.inci_name}`);
      
      // Check if INCI item exists, create if needed
      let inciItem = mondayInciItems.find(item => 
        item.name.toLowerCase() === ingredient.inci_name.toLowerCase()
      );
      
      if (!inciItem) {
        console.log(`  🆕 Creating INCI item: ${ingredient.inci_name}`);
        
        const createInciMutation = `
          mutation {
            create_item (
              board_id: ${inciBoardId},
              item_name: "${ingredient.inci_name.replace(/"/g, '\\"')}"
            ) {
              id
              name
            }
          }
        `;
        
        try {
          const inciResponse = await monday.api(createInciMutation);
          inciItem = inciResponse.data?.create_item;
          inciCreatedCount++;
          console.log(`    ✅ Created INCI item: ${inciItem.name}`);
          
          // Add to our local list
          mondayInciItems.push(inciItem);
          
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`    ❌ Failed to create INCI item: ${error.message}`);
          continue;
        }
      }
      
      // Update the ingredient with INCI information
      try {
        const inciText = `${ingredient.inci_name}\\\\nCategory: ${ingredient.category || 'Unknown'}\\\\nUsed in: ${ingredient.usage_count} formulas`;
        
        const updateMutation = `
          mutation {
            change_column_value (
              board_id: ${ingredientsBoardId},
              item_id: ${mondayIngredient.id},
              column_id: "${inciColumnId}",
              value: "${JSON.stringify(inciText).replace(/"/g, '\\"')}"
            ) {
              id
            }
          }
        `;
        
        await monday.api(updateMutation);
        updatedCount++;
        console.log(`  ✅ Updated INCI data for ${ingredient.ingredient_name}`);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`  ❌ Failed to update INCI for ${ingredient.ingredient_name}: ${error.message}`);
      }
    }
    
    console.log(`\\n🎉 INCI connection process complete!`);
    console.log(`📊 Updated: ${updatedCount} ingredients with INCI data`);
    console.log(`🆕 Created: ${inciCreatedCount} new INCI items`);
    
  } catch (error) {
    console.error('❌ Error connecting ingredients to INCI:', error.message);
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
    } else if (args[i] === '--max-ingredients' && args[i + 1]) {
      options.maxIngredients = parseInt(args[i + 1]);
      i++;
    }
  }
  
  if (options.dryRun) {
    console.log('🔍 Running in dry-run mode...');
  }
  
  connectIngredientsInci(options);
}

module.exports = { connectIngredientsInci };