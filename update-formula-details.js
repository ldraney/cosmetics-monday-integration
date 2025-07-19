const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function updateFormulaDetails(options = {}) {
  console.log('📝 Updating formula details with ingredient information...\n');
  
  const { dryRun = false, maxFormulas = 10 } = options;
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const formulasBoardId = process.env.FORMULAS_BOARD_ID;
    
    // Get formulas with their ingredients and pricing from database
    console.log('📊 Fetching formulas with complete ingredient data...');
    
    const formulaDetailsQuery = `
      SELECT 
        f.id as formula_id,
        f.name as formula_name,
        f.version,
        f.status,
        f.review_reasons,
        f.created_date,
        ROUND(SUM(fi.percentage)::numeric, 2) as total_percentage,
        COUNT(fi.id) as ingredient_count,
        json_agg(
          json_build_object(
            'name', i.name,
            'percentage', fi.percentage,
            'inci_name', i.inci_name,
            'category', i.category
          ) ORDER BY fi.percentage DESC
        ) as ingredients_detail
      FROM formulas f
      LEFT JOIN formula_ingredients fi ON f.id = fi.formula_id
      LEFT JOIN ingredients i ON fi.ingredient_id = i.id
      WHERE f.status = 'approved'
      GROUP BY f.id, f.name, f.version, f.status, f.review_reasons, f.created_date
      ORDER BY f.id
      LIMIT ${maxFormulas * 2}
    `;
    
    const result = await pool.query(formulaDetailsQuery);
    console.log(`✅ Found ${result.rows.length} formulas with detailed ingredient data`);
    
    // Get Monday formulas
    console.log('📋 Getting Monday formulas...');
    
    const mondayQuery = `
      query {
        boards(ids: [${formulasBoardId}]) {
          items_page(limit: 200) {
            items {
              id
              name
              column_values {
                id
                text
                value
              }
            }
          }
        }
      }
    `;
    
    const mondayResponse = await monday.api(mondayQuery);
    const mondayFormulas = mondayResponse.data?.boards?.[0]?.items_page?.items || [];
    console.log(`📊 Found ${mondayFormulas.length} formulas on Monday`);
    
    if (dryRun) {
      console.log('\\n📋 PREVIEW - Formula updates that would be made:');
      result.rows.slice(0, 3).forEach(formula => {
        const ingredients = formula.ingredients_detail.slice(0, 5);
        console.log(`\\n🧪 ${formula.formula_name} v${formula.version}:`);
        console.log(`  📊 Total: ${formula.total_percentage}% | Ingredients: ${formula.ingredient_count}`);
        console.log(`  🧪 Top ingredients:`);
        ingredients.forEach(ing => {
          const inci = ing.inci_name ? ` (${ing.inci_name})` : '';
          console.log(`    • ${ing.name}: ${ing.percentage}%${inci}`);
        });
      });
      return;
    }
    
    // Process each formula
    let updatedCount = 0;
    
    for (const formula of result.rows.slice(0, maxFormulas)) {
      // Find matching Monday formula
      const mondayFormula = mondayFormulas.find(mf => 
        mf.name.toLowerCase().includes(formula.formula_name.toLowerCase()) ||
        formula.formula_name.toLowerCase().includes(mf.name.toLowerCase())
      );
      
      if (!mondayFormula) {
        console.log(`⚠️  No Monday item found for formula: ${formula.formula_name}`);
        continue;
      }
      
      console.log(`\\n📝 Updating: ${formula.formula_name}`);
      
      // Get ingredient pricing data to calculate total cost
      const ingredientPricingQuery = `
        SELECT 
          fi.percentage,
          i.name as ingredient_name,
          ip.price_per_kg
        FROM formula_ingredients fi
        JOIN ingredients i ON fi.ingredient_id = i.id
        LEFT JOIN ingredient_pricing ip ON i.id = ip.ingredient_id
        WHERE fi.formula_id = $1
        ORDER BY fi.percentage DESC
      `;
      
      const pricingResult = await pool.query(ingredientPricingQuery, [formula.formula_id]);
      const pricedIngredients = pricingResult.rows.filter(row => row.price_per_kg);
      
      let totalCost = 0;
      let pricedPercentage = 0;
      
      pricedIngredients.forEach(ing => {
        const cost = (ing.percentage / 100) * parseFloat(ing.price_per_kg);
        totalCost += cost;
        pricedPercentage += ing.percentage;
      });
      
      // Create detailed ingredient list for notes
      const topIngredients = formula.ingredients_detail.slice(0, 10);
      const ingredientList = topIngredients.map(ing => {
        const inci = ing.inci_name ? ` (${ing.inci_name})` : '';
        return `${ing.name}: ${ing.percentage}%${inci}`;
      }).join('\\\\n');
      
      const moreCount = formula.ingredient_count - topIngredients.length;
      const additionalNote = moreCount > 0 ? `\\\\n... and ${moreCount} more ingredients` : '';
      
      const formulaNotesContent = `Formula ID: ${formula.formula_id}\\\\n` +
        `Version: ${formula.version}\\\\n` +
        `Status: ${formula.status}\\\\n` +
        `Total: ${formula.total_percentage}%\\\\n` +
        `Ingredients: ${formula.ingredient_count}\\\\n\\\\n` +
        `TOP INGREDIENTS:\\\\n${ingredientList}${additionalNote}\\\\n\\\\n` +
        `Cost Coverage: ${pricedPercentage.toFixed(1)}% of formula has pricing\\\\n` +
        `Est. Cost/KG: $${totalCost.toFixed(2)} (based on ${pricedIngredients.length} priced ingredients)\\\\n\\\\n` +
        `Created: ${formula.created_date ? new Date(formula.created_date).toLocaleDateString() : 'Unknown'}`;
      
      try {
        // Update multiple columns
        const updates = [
          // Update Formula Notes
          {
            column_id: 'long_text_mkt0sc7t', // Formula Notes column
            value: JSON.stringify(formulaNotesContent)
          },
          // Update Total Percentage
          {
            column_id: 'numeric_mkt036p', // Total Percentage column
            value: formula.total_percentage.toString()
          },
          // Update Ingredient Count
          {
            column_id: 'numeric_mkt02cns', // Ingredient Count column
            value: formula.ingredient_count.toString()
          },
          // Update Total Cost per KG
          {
            column_id: 'numeric_mkt0zz9w', // Total Cost per KG column
            value: totalCost.toFixed(2)
          },
          // Update Formula Status
          {
            column_id: 'color_mkt0v471', // Formula Status column
            value: JSON.stringify({
              "label": formula.status === 'approved' ? 'Approved' : 'Needs Review',
              "color": formula.status === 'approved' ? 'green' : 'orange'
            })
          },
          // Update Created Date
          {
            column_id: 'date_mkt03rt6', // Created Date column
            value: JSON.stringify({
              "date": formula.created_date ? formula.created_date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
            })
          },
          // Update Formula Version
          {
            column_id: 'text_mkt08yz2', // Formula Version column
            value: JSON.stringify(formula.version)
          }
        ];
        
        // Apply updates one by one
        for (const update of updates) {
          const updateMutation = `
            mutation {
              change_column_value (
                board_id: ${formulasBoardId},
                item_id: ${mondayFormula.id},
                column_id: "${update.column_id}",
                value: "${update.value.replace(/"/g, '\\"')}"
              ) {
                id
              }
            }
          `;
          
          await monday.api(updateMutation);
          await new Promise(resolve => setTimeout(resolve, 200)); // Small delay
        }
        
        updatedCount++;
        console.log(`  ✅ Updated all columns for ${formula.formula_name}`);
        console.log(`    💰 Estimated cost: $${totalCost.toFixed(2)}/kg (${pricedPercentage.toFixed(1)}% coverage)`);
        console.log(`    📊 ${formula.ingredient_count} ingredients, ${formula.total_percentage}% total`);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`  ❌ Failed to update ${formula.formula_name}: ${error.message}`);
      }
    }
    
    console.log(`\\n🎉 Update process complete!`);
    console.log(`📊 Updated: ${updatedCount} formulas with detailed ingredient information`);
    
  } catch (error) {
    console.error('❌ Error updating formula details:', error.message);
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
    } else if (args[i] === '--max-formulas' && args[i + 1]) {
      options.maxFormulas = parseInt(args[i + 1]);
      i++;
    }
  }
  
  if (options.dryRun) {
    console.log('🔍 Running in dry-run mode...');
  }
  
  updateFormulaDetails(options);
}

module.exports = { updateFormulaDetails };