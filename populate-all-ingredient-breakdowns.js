const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function populateAllIngredientBreakdowns() {
  console.log('🧪 Populating ALL formulas with ingredient breakdowns...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const formulasBoardId = process.env.FORMULAS_BOARD_ID;
    const ingredientBreakdownColumnId = 'long_text_mkt0b95w'; // From previous creation
    
    // Get all formulas with their ingredients
    console.log('📊 Fetching all formulas with ingredients from database...');
    
    const formulasQuery = `
      SELECT 
        f.id as formula_id,
        f.name as formula_name,
        f.version,
        f.status,
        ROUND(SUM(fi.percentage)::numeric, 2) as total_percentage,
        COUNT(fi.id) as ingredient_count,
        json_agg(
          json_build_object(
            'ingredient_name', i.name,
            'percentage', fi.percentage,
            'inci_name', i.inci_name,
            'category', i.category
          ) ORDER BY fi.percentage DESC
        ) as ingredients
      FROM formulas f
      LEFT JOIN formula_ingredients fi ON f.id = fi.formula_id
      LEFT JOIN ingredients i ON fi.ingredient_id = i.id
      WHERE f.status = 'approved'
      GROUP BY f.id, f.name, f.version, f.status
      ORDER BY f.name
      LIMIT 20
    `;
    
    const result = await pool.query(formulasQuery);
    console.log(`✅ Found ${result.rows.length} formulas to process`);
    
    // Get Monday formulas
    console.log('📋 Getting Monday formulas...');
    
    const mondayFormulasQuery = `
      query {
        boards(ids: [${formulasBoardId}]) {
          items_page(limit: 100) {
            items {
              id
              name
            }
          }
        }
      }
    `;
    
    const formulaResponse = await monday.api(mondayFormulasQuery);
    const mondayFormulas = formulaResponse.data?.boards?.[0]?.items_page?.items || [];
    console.log(`📊 Found ${mondayFormulas.length} formulas on Monday`);
    
    // Process each formula
    let updatedCount = 0;
    
    for (const formula of result.rows) {
      // Find matching Monday formula
      const mondayFormula = mondayFormulas.find(mf => 
        mf.name.toLowerCase().includes(formula.formula_name.toLowerCase()) ||
        formula.formula_name.toLowerCase().includes(mf.name.toLowerCase())
      );
      
      if (!mondayFormula) {
        console.log(`⚠️  No Monday item found for: ${formula.formula_name}`);
        continue;
      }
      
      console.log(`\\n🔧 Processing: ${formula.formula_name}`);
      
      // Create detailed ingredient breakdown
      let ingredientText = `FORMULA: ${formula.formula_name} v${formula.version}\\n`;
      ingredientText += `STATUS: ${formula.status} | TOTAL: ${formula.total_percentage}%\\n`;
      ingredientText += `═══════════════════════════════════════════════\\n\\n`;
      
      ingredientText += `INGREDIENTS (${formula.ingredient_count} total):\\n\\n`;
      
      let runningCost = 0;
      let pricedIngredients = 0;
      
      formula.ingredients.forEach((ing, index) => {
        ingredientText += `${(index + 1).toString().padStart(2, ' ')}. ${ing.ingredient_name}\\n`;
        ingredientText += `    Percentage: ${ing.percentage}%\\n`;
        
        if (ing.inci_name) {
          ingredientText += `    INCI: ${ing.inci_name}\\n`;
        }
        
        if (ing.category) {
          ingredientText += `    Category: ${ing.category}\\n`;
        }
        
        ingredientText += `    💡 Search in Ingredients board: "${ing.ingredient_name}"\\n`;
        ingredientText += `\\n`;
      });
      
      ingredientText += `\\n═══════════════════════════════════════════════\\n`;
      ingredientText += `SUMMARY:\\n`;
      ingredientText += `• Total Ingredients: ${formula.ingredient_count}\\n`;
      ingredientText += `• Total Percentage: ${formula.total_percentage}%\\n`;
      ingredientText += `• Formula Status: ${formula.status}\\n`;
      ingredientText += `• Last Updated: ${new Date().toLocaleDateString()}\\n\\n`;
      
      ingredientText += `USAGE INSTRUCTIONS:\\n`;
      ingredientText += `1. Search ingredient names in "🧪 Ingredients Master Database"\\n`;
      ingredientText += `2. Check pricing and supplier information\\n`;
      ingredientText += `3. Calculate total formula cost based on percentages\\n`;
      ingredientText += `4. Use for production planning and cost analysis`;
      
      try {
        // Update the Monday item
        const updateMutation = `
          mutation {
            change_column_value (
              board_id: ${formulasBoardId},
              item_id: ${mondayFormula.id},
              column_id: "${ingredientBreakdownColumnId}",
              value: "${JSON.stringify(ingredientText).replace(/"/g, '\\"')}"
            ) {
              id
            }
          }
        `;
        
        await monday.api(updateMutation);
        updatedCount++;
        
        console.log(`  ✅ Updated ingredient breakdown`);
        console.log(`  📊 ${formula.ingredient_count} ingredients, ${formula.total_percentage}% total`);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`  ❌ Failed to update ${formula.formula_name}: ${error.message}`);
      }
    }
    
    console.log(`\\n🎉 COMPLETE!`);
    console.log(`📊 Updated ${updatedCount} formulas with detailed ingredient breakdowns`);
    
    console.log(`\\n🎯 WHAT YOU NOW HAVE:`);
    console.log(`• Detailed ingredient lists for each formula`);
    console.log(`• Percentages and INCI names included`);
    console.log(`• Searchable ingredient references`);
    console.log(`• Instructions for finding pricing data`);
    console.log(`• Complete traceability from formula to ingredients`);
    
    console.log(`\\n💡 HOW TO USE:`);
    console.log(`1. Open Monday Formulas board`);
    console.log(`2. Click on any formula`);
    console.log(`3. View "Ingredient Breakdown" column`);
    console.log(`4. Search ingredient names in Ingredients board for pricing`);
    console.log(`5. Calculate costs based on percentages`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  populateAllIngredientBreakdowns();
}

module.exports = { populateAllIngredientBreakdowns };