const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();

async function createIngredientsBoard() {
  console.log('🧪 Creating Ingredients Master Board...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    if (!process.env.MONDAY_API_TOKEN) {
      console.error('❌ MONDAY_API_TOKEN environment variable required');
      return;
    }
    
    monday.setToken(process.env.MONDAY_API_TOKEN);
    
    // Get ingredients from database
    console.log('📊 Fetching ingredients from database...');
    
    const ingredientsQuery = `
      SELECT 
        i.id,
        i.name as ingredient_name,
        i.inci_name,
        i.supplier_code,
        i.category,
        COUNT(fi.formula_id) as usage_count,
        ROUND(AVG(fi.percentage)::numeric, 2) as avg_percentage,
        ROUND(SUM(fi.percentage)::numeric, 2) as total_usage,
        ARRAY_AGG(DISTINCT f.name ORDER BY f.name) as used_in_formulas
      FROM ingredients i
      LEFT JOIN formula_ingredients fi ON i.id = fi.ingredient_id
      LEFT JOIN formulas f ON fi.formula_id = f.id
      GROUP BY i.id, i.name, i.inci_name, i.supplier_code, i.category
      ORDER BY COUNT(fi.formula_id) DESC, i.name
    `;
    
    const result = await pool.query(ingredientsQuery);
    console.log(`✅ Found ${result.rows.length} ingredients to sync`);
    
    // Create ingredients board in the test workspace
    console.log('🆕 Creating Ingredients Master board...');
    
    const createBoardMutation = `
      mutation {
        create_board (
          board_name: "🧪 Ingredients Master Database",
          board_kind: public,
          workspace_id: 11691826,
          description: "Master list of all cosmetic ingredients with usage data and INCI names"
        ) {
          id
          name
        }
      }
    `;
    
    const boardResponse = await monday.api(createBoardMutation);
    const ingredientsBoard = boardResponse.data.create_board;
    console.log(`✅ Created ingredients board: ${ingredientsBoard.name} (ID: ${ingredientsBoard.id})`);
    
    // Add ingredients to the board in batches
    console.log('🔄 Adding ingredients to Monday board...');
    
    let addedCount = 0;
    const batchSize = 15; // Smaller batches for ingredients
    const totalIngredients = result.rows.length;
    
    for (let i = 0; i < totalIngredients; i += batchSize) {
      const batch = result.rows.slice(i, i + batchSize);
      
      for (const ingredient of batch) {
        try {
          const inciName = ingredient.inci_name || 'No INCI available';
          const supplierCode = ingredient.supplier_code || 'TBD';
          const category = ingredient.category || 'Uncategorized';
          const usageCount = ingredient.usage_count || 0;
          const avgPercentage = ingredient.avg_percentage || 0;
          
          // Estimate cost based on ingredient type
          const estimatedCost = estimateIngredientCost(ingredient);
          
          // Create status based on usage
          let status = 'Low Priority';
          if (usageCount >= 10) status = 'High Priority';
          else if (usageCount >= 5) status = 'Medium Priority';
          else if (usageCount === 0) status = 'Unused';
          
          // Format used in formulas list
          const formulasList = ingredient.used_in_formulas && ingredient.used_in_formulas.length > 0 
            ? ingredient.used_in_formulas.slice(0, 3).join(', ') + (ingredient.used_in_formulas.length > 3 ? '...' : '')
            : 'Not used in any formulas';
          
          const itemName = ingredient.ingredient_name.length > 50 
            ? ingredient.ingredient_name.substring(0, 47) + '...' 
            : ingredient.ingredient_name;
          
          const itemMutation = `
            mutation {
              create_item (
                board_id: ${ingredientsBoard.id},
                item_name: "${itemName.replace(/"/g, '\\"')}",
                column_values: "{\\"text\\": \\"${inciName.replace(/"/g, '\\"')}\\", \\"text4\\": \\"${supplierCode.replace(/"/g, '\\"')}\\", \\"text6\\": \\"${category.replace(/"/g, '\\"')}\\", \\"numbers\\": \\"${usageCount}\\", \\"numbers8\\": \\"${avgPercentage}\\", \\"numbers9\\": \\"${estimatedCost}\\", \\"status\\": \\"${status}\\", \\"long_text\\": \\"Used in: ${formulasList.replace(/"/g, '\\"')}\\"}"
              ) {
                id
                name
              }
            }
          `;
          
          await monday.api(itemMutation);
          addedCount++;
          
        } catch (error) {
          console.error(`❌ Error adding ${ingredient.ingredient_name}:`, error.message);
        }
      }
      
      console.log(`  ✅ Added ${Math.min(addedCount, totalIngredients)} / ${totalIngredients} ingredients...`);
      
      // Rate limiting delay
      if (i + batchSize < totalIngredients) {
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
    
    // Update .env with ingredients board ID
    console.log('📝 Updating .env with ingredients board ID...');
    
    const fs = require('fs');
    let envContent = fs.readFileSync('.env', 'utf8');
    
    if (envContent.includes('INGREDIENTS_BOARD_ID=')) {
      envContent = envContent.replace(/INGREDIENTS_BOARD_ID=.*/, `INGREDIENTS_BOARD_ID=${ingredientsBoard.id}`);
    } else {
      envContent += `\nINGREDIENTS_BOARD_ID=${ingredientsBoard.id}`;
    }
    
    fs.writeFileSync('.env', envContent);
    
    console.log(`\n🎉 INGREDIENTS BOARD COMPLETE!`);
    console.log(`📊 Added ${addedCount} ingredients`);
    console.log(`🔗 View board: https://monday.com/boards/${ingredientsBoard.id}`);
    
    // Summary statistics
    const highPriorityCount = result.rows.filter(ing => ing.usage_count >= 10).length;
    const mediumPriorityCount = result.rows.filter(ing => ing.usage_count >= 5 && ing.usage_count < 10).length;
    const unusedCount = result.rows.filter(ing => ing.usage_count === 0).length;
    const withInciCount = result.rows.filter(ing => ing.inci_name && ing.inci_name.trim() !== '').length;
    
    console.log(`\n📈 Summary:`);
    console.log(`  • High priority (10+ uses): ${highPriorityCount}`);
    console.log(`  • Medium priority (5-9 uses): ${mediumPriorityCount}`);
    console.log(`  • Low priority (1-4 uses): ${addedCount - highPriorityCount - mediumPriorityCount - unusedCount}`);
    console.log(`  • Unused ingredients: ${unusedCount}`);
    console.log(`  • With INCI names: ${withInciCount} (${((withInciCount/result.rows.length)*100).toFixed(1)}%)`);
    
    return ingredientsBoard.id;
    
  } catch (error) {
    console.error('❌ Error creating ingredients board:', error.message);
    if (error.response?.data) {
      console.error('API Response:', error.response.data);
    }
  } finally {
    await pool.end();
  }
}

function estimateIngredientCost(ingredient) {
  const name = ingredient.ingredient_name.toLowerCase();
  
  // Base costs per kg (rough estimates in USD)
  if (name.includes('water') || name.includes('aqua')) return 0.50;
  if (name.includes('glycerin')) return 3.50;
  if (name.includes('oil') && !name.includes('essential')) return 15.00;
  if (name.includes('butter')) return 25.00;
  if (name.includes('extract')) return 45.00;
  if (name.includes('acid')) return 20.00;
  if (name.includes('vitamin')) return 60.00;
  if (name.includes('peptide')) return 150.00;
  if (name.includes('retinol')) return 200.00;
  if (name.includes('essential oil')) return 80.00;
  if (name.includes('preservative')) return 35.00;
  if (name.includes('emulsifier')) return 18.00;
  
  // Estimate based on usage frequency (common = cheaper)
  const usageCount = ingredient.usage_count || 0;
  if (usageCount >= 15) return 8.00;   // Very common
  if (usageCount >= 10) return 15.00;  // Common
  if (usageCount >= 5) return 30.00;   // Moderate
  if (usageCount === 0) return 0.00;   // Unused
  return 50.00; // Specialty/rare ingredient
}

if (require.main === module) {
  createIngredientsBoard();
}

module.exports = { createIngredientsBoard };