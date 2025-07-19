const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();

async function createPricingBoard(options = {}) {
  console.log('💰 Creating Monday.com Ingredient Pricing Board...');
  
  const { withEstimates = false, topN = 50 } = options;
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    if (!process.env.MONDAY_API_TOKEN) {
      console.error('❌ MONDAY_API_TOKEN environment variable required');
      return;
    }
    
    monday.setToken(process.env.MONDAY_API_TOKEN);
    
    // Get ingredient usage analysis
    console.log('📊 Analyzing ingredient usage patterns...');
    
    const ingredientAnalysisQuery = `
      SELECT 
        i.id,
        i.name as ingredient_name,
        i.inci_name,
        i.supplier_code,
        COUNT(fi.formula_id) as formula_count,
        ROUND(AVG(fi.percentage)::numeric, 2) as avg_percentage,
        ROUND(SUM(fi.percentage)::numeric, 2) as total_usage,
        ROUND(MIN(fi.percentage)::numeric, 2) as min_percentage,
        ROUND(MAX(fi.percentage)::numeric, 2) as max_percentage,
        ARRAY_AGG(DISTINCT f.name ORDER BY f.name) as used_in_formulas
      FROM ingredients i
      JOIN formula_ingredients fi ON i.id = fi.ingredient_id
      JOIN formulas f ON fi.formula_id = f.id
      GROUP BY i.id, i.name, i.inci_name, i.supplier_code
      HAVING COUNT(fi.formula_id) >= 2
      ORDER BY formula_count DESC, total_usage DESC
      LIMIT $1
    `;
    
    const result = await pool.query(ingredientAnalysisQuery, [topN]);
    console.log(`✅ Found ${result.rows.length} frequently used ingredients`);
    
    // Check for existing pricing board
    const boardsQuery = `
      query {
        boards(limit: 50) {
          id
          name
          description
        }
      }
    `;
    
    const boardsResponse = await monday.api(boardsQuery);
    
    let pricingBoard = boardsResponse.data.boards.find(board => 
      board.name.toLowerCase().includes('pricing') || 
      board.name.toLowerCase().includes('ingredient')
    );
    
    if (!pricingBoard && !process.env.PRICING_BOARD_ID) {
      console.log('🆕 Creating new Ingredient Pricing & Usage board...');
      
      const createBoardMutation = `
        mutation {
          create_board (
            board_name: "Ingredient Pricing & Usage Analysis",
            board_kind: public,
            description: "Cost analysis and usage patterns for cosmetic ingredients - Auto-generated from database"
          ) {
            id
            name
          }
        }
      `;
      
      const boardResponse = await monday.api(createBoardMutation);
      pricingBoard = boardResponse.data.create_board;
      console.log(`✅ Created pricing board: ${pricingBoard.name} (ID: ${pricingBoard.id})`);
    } else if (process.env.PRICING_BOARD_ID) {
      pricingBoard = { id: process.env.PRICING_BOARD_ID, name: 'Existing Pricing Board' };
      console.log(`✅ Using configured pricing board ID: ${pricingBoard.id}`);
    } else {
      console.log(`✅ Using existing pricing board: ${pricingBoard.name} (ID: ${pricingBoard.id})`);
    }
    
    // Add ingredient data to pricing board
    console.log('💰 Adding ingredient pricing data...');
    
    let addedCount = 0;
    const totalIngredients = result.rows.length;
    
    for (const ingredient of result.rows) {
      try {
        const costEstimate = withEstimates ? estimateIngredientCost(ingredient) : 0;
        const priority = getPriorityLevel(ingredient.formula_count);
        const inciName = ingredient.inci_name || 'No INCI available';
        const supplierCode = ingredient.supplier_code || 'TBD';
        const formulaList = ingredient.used_in_formulas.slice(0, 3).join(', ') + 
                           (ingredient.used_in_formulas.length > 3 ? '...' : '');
        
        const itemName = ingredient.ingredient_name.length > 50 ? 
                        ingredient.ingredient_name.substring(0, 47) + '...' : 
                        ingredient.ingredient_name;
        
        const columnValues = JSON.stringify({
          text: inciName.replace(/"/g, '\\"'),
          numbers: ingredient.formula_count.toString(),
          numbers3: ingredient.avg_percentage.toString(),
          numbers4: ingredient.total_usage.toString(),
          ...(withEstimates && { numbers6: costEstimate.toString() }),
          text7: supplierCode,
          status: priority,
          long_text: `Usage: ${ingredient.min_percentage}% - ${ingredient.max_percentage}%\\nUsed in: ${formulaList}`
        });
        
        const itemMutation = `
          mutation {
            create_item (
              board_id: ${pricingBoard.id},
              item_name: "${itemName.replace(/"/g, '\\"')}",
              column_values: "${columnValues.replace(/"/g, '\\"')}"
            ) {
              id
              name
            }
          }
        `;
        
        await monday.api(itemMutation);
        addedCount++;
        
        if (addedCount % 10 === 0) {
          console.log(`  ✅ Added ${addedCount} / ${totalIngredients} ingredients...`);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`❌ Error adding ${ingredient.ingredient_name}:`, error.message);
      }
    }
    
    // Create summary statistics
    const totalEstimatedCost = withEstimates ? 
      result.rows.reduce((sum, ing) => sum + estimateIngredientCost(ing) * (ing.total_usage / 100), 0) : 0;
    
    const highPriorityCount = result.rows.filter(ing => ing.formula_count >= 10).length;
    const mediumPriorityCount = result.rows.filter(ing => ing.formula_count >= 5 && ing.formula_count < 10).length;
    
    console.log(`\n💰 PRICING ANALYSIS COMPLETE`);
    console.log(`📊 Added ${addedCount} ingredients to pricing board`);
    console.log(`🔥 High priority ingredients: ${highPriorityCount}`);
    console.log(`🟡 Medium priority ingredients: ${mediumPriorityCount}`);
    if (withEstimates) {
      console.log(`💵 Estimated total cost: $${totalEstimatedCost.toFixed(2)}`);
    }
    console.log(`🔗 View pricing board: https://monday.com/boards/${pricingBoard.id}`);
    
    // Add summary item
    try {
      const summaryColumnValues = JSON.stringify({
        text: `Analysis of top ${addedCount} ingredients`,
        numbers: addedCount.toString(),
        ...(withEstimates && { numbers6: totalEstimatedCost.toFixed(2) }),
        status: 'Critical',
        long_text: `High Priority: ${highPriorityCount}\\nMedium Priority: ${mediumPriorityCount}\\nGenerated: ${new Date().toISOString()}`
      });
      
      await monday.api(`
        mutation {
          create_item (
            board_id: ${pricingBoard.id},
            item_name: "📊 ANALYSIS SUMMARY",
            column_values: "${summaryColumnValues.replace(/"/g, '\\"')}"
          ) {
            id
          }
        }
      `);
      
      console.log(`✅ Added summary item to board`);
    } catch (error) {
      console.log(`⚠️  Could not add summary item: ${error.message}`);
    }
    
  } catch (error) {
    console.error('❌ Error creating pricing board:', error.message);
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
  if (ingredient.formula_count >= 15) return 8.00;   // Very common
  if (ingredient.formula_count >= 10) return 15.00;  // Common
  if (ingredient.formula_count >= 5) return 30.00;   // Moderate
  return 50.00; // Specialty/rare ingredient
}

function getPriorityLevel(formulaCount) {
  if (formulaCount >= 10) return 'High';
  if (formulaCount >= 5) return 'Medium';
  return 'Low';
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--with-estimates') {
      options.withEstimates = true;
    } else if (args[i] === '--top' && args[i + 1]) {
      options.topN = parseInt(args[i + 1]);
      i++;
    }
  }
  
  // Check environment
  if (!process.env.MONDAY_API_TOKEN) {
    console.log('\n🔑 Setup Required:');
    console.log('1. Copy .env.example to .env');
    console.log('2. Add your Monday.com API token to .env');
    console.log('3. Run again with: npm run pricing\n');
    process.exit(1);
  }
  
  createPricingBoard(options);
}

module.exports = { createPricingBoard };