const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function calculateFormulaCosts(options = {}) {
  console.log('💰 Calculating formula costs using Monday pricing data...\n');
  
  const { dryRun = false, maxFormulas = 10 } = options;
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const formulasBoardId = process.env.FORMULAS_BOARD_ID;
    const ingredientsBoardId = process.env.INGREDIENTS_BOARD_ID;
    
    // Step 1: Get pricing data from Monday ingredients board
    console.log('💰 Fetching pricing data from Monday ingredients board...');
    
    const pricingQuery = `
      query {
        boards(ids: [${ingredientsBoardId}]) {
          items_page(limit: 500) {
            items {
              id
              name
              column_values(ids: ["numeric_mkt0v0h6"]) {
                id
                text
                value
              }
            }
          }
        }
      }
    `;
    
    const pricingResponse = await monday.api(pricingQuery);
    const ingredientItems = pricingResponse.data?.boards?.[0]?.items_page?.items || [];
    
    // Build pricing lookup
    const pricingLookup = {};
    let pricedCount = 0;
    
    ingredientItems.forEach(item => {
      const priceColumn = item.column_values.find(cv => cv.id === 'numeric_mkt0v0h6');
      if (priceColumn && priceColumn.text && priceColumn.text !== '' && priceColumn.text !== '0') {
        const price = parseFloat(priceColumn.text);
        if (!isNaN(price) && price > 0) {
          pricingLookup[item.name.toLowerCase()] = {
            name: item.name,
            price_per_kg: price,
            monday_id: item.id
          };
          pricedCount++;
        }
      }
    });
    
    console.log(`✅ Found pricing for ${pricedCount} ingredients on Monday`);
    
    // Step 2: Get formulas with ingredients from database
    console.log('📊 Fetching formulas with ingredients from database...');
    
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
            'ingredient_id', i.id,
            'ingredient_name', i.name,
            'percentage', fi.percentage,
            'inci_name', i.inci_name
          ) ORDER BY fi.percentage DESC
        ) as ingredients
      FROM formulas f
      LEFT JOIN formula_ingredients fi ON f.id = fi.formula_id
      LEFT JOIN ingredients i ON fi.ingredient_id = i.id
      WHERE f.status = 'approved'
      GROUP BY f.id, f.name, f.version, f.status
      ORDER BY f.id
      LIMIT ${maxFormulas * 2}
    `;
    
    const formulasResult = await pool.query(formulasQuery);
    console.log(`✅ Found ${formulasResult.rows.length} formulas to cost`);
    
    // Step 3: Get Monday formulas
    console.log('📋 Getting Monday formulas...');
    
    const mondayFormulasQuery = `
      query {
        boards(ids: [${formulasBoardId}]) {
          items_page(limit: 200) {
            items {
              id
              name
              column_values(ids: ["numeric_mkt0zz9w"]) {
                id
                text
                value
              }
            }
          }
        }
      }
    `;
    
    const mondayFormulasResponse = await monday.api(mondayFormulasQuery);
    const mondayFormulas = mondayFormulasResponse.data?.boards?.[0]?.items_page?.items || [];
    console.log(`📊 Found ${mondayFormulas.length} formulas on Monday`);
    
    if (dryRun) {
      console.log('\\n📋 PREVIEW - Cost calculations that would be made:');
      
      formulasResult.rows.slice(0, 5).forEach(formula => {
        console.log(`\\n🧪 ${formula.formula_name} v${formula.version}:`);
        
        let totalCost = 0;
        let pricedPercentage = 0;
        let unpricedCount = 0;
        const costBreakdown = [];
        
        formula.ingredients.forEach(ing => {
          const matchedPricing = findBestPriceMatch(ing.ingredient_name, pricingLookup);
          
          if (matchedPricing) {
            const ingredientCost = (ing.percentage / 100) * matchedPricing.price_per_kg;
            totalCost += ingredientCost;
            pricedPercentage += ing.percentage;
            costBreakdown.push({
              name: ing.ingredient_name,
              percentage: ing.percentage,
              price_per_kg: matchedPricing.price_per_kg,
              cost: ingredientCost
            });
          } else {
            unpricedCount++;
          }
        });
        
        console.log(`  💰 Estimated cost: $${totalCost.toFixed(2)}/kg`);
        console.log(`  📊 Coverage: ${pricedPercentage.toFixed(1)}% of formula has pricing`);
        console.log(`  ❌ ${unpricedCount} ingredients without pricing`);
        
        if (costBreakdown.length > 0) {
          console.log(`  🔍 Top cost contributors:`);
          costBreakdown
            .sort((a, b) => b.cost - a.cost)
            .slice(0, 3)
            .forEach(item => {
              console.log(`    • ${item.name}: $${item.cost.toFixed(2)} (${item.percentage}% × $${item.price_per_kg}/kg)`);
            });
        }
      });
      return;
    }
    
    // Step 4: Calculate and update costs
    let updatedCount = 0;
    const costSummary = {
      total_formulas: 0,
      average_cost: 0,
      best_coverage: 0,
      total_cost: 0
    };
    
    for (const formula of formulasResult.rows.slice(0, maxFormulas)) {
      // Find matching Monday formula
      const mondayFormula = mondayFormulas.find(mf => 
        mf.name.toLowerCase().includes(formula.formula_name.toLowerCase()) ||
        formula.formula_name.toLowerCase().includes(mf.name.toLowerCase())
      );
      
      if (!mondayFormula) {
        console.log(`⚠️  No Monday item found for formula: ${formula.formula_name}`);
        continue;
      }
      
      console.log(`\\n💰 Calculating cost for: ${formula.formula_name}`);
      
      let totalCost = 0;
      let pricedPercentage = 0;
      let pricedIngredientsCount = 0;
      const costDetails = [];
      
      // Calculate cost for each ingredient
      formula.ingredients.forEach(ing => {
        const matchedPricing = findBestPriceMatch(ing.ingredient_name, pricingLookup);
        
        if (matchedPricing) {
          const ingredientCost = (ing.percentage / 100) * matchedPricing.price_per_kg;
          totalCost += ingredientCost;
          pricedPercentage += ing.percentage;
          pricedIngredientsCount++;
          
          costDetails.push({
            name: ing.ingredient_name,
            percentage: ing.percentage,
            price_per_kg: matchedPricing.price_per_kg,
            cost: ingredientCost
          });
        }
      });
      
      const coverage = (pricedPercentage / formula.total_percentage) * 100;
      
      console.log(`  💰 Total cost: $${totalCost.toFixed(2)}/kg`);
      console.log(`  📊 Coverage: ${coverage.toFixed(1)}% (${pricedIngredientsCount}/${formula.ingredient_count} ingredients)`);
      
      // Update the cost in Monday
      try {
        const updateMutation = `
          mutation {
            change_column_value (
              board_id: ${formulasBoardId},
              item_id: ${mondayFormula.id},
              column_id: "numeric_mkt0zz9w",
              value: "${totalCost.toFixed(2)}"
            ) {
              id
            }
          }
        `;
        
        await monday.api(updateMutation);
        updatedCount++;
        
        // Update summary stats
        costSummary.total_formulas++;
        costSummary.total_cost += totalCost;
        costSummary.best_coverage = Math.max(costSummary.best_coverage, coverage);
        
        console.log(`  ✅ Updated Monday cost: $${totalCost.toFixed(2)}/kg`);
        
        // Show top cost contributors
        if (costDetails.length > 0) {
          const topContributors = costDetails
            .sort((a, b) => b.cost - a.cost)
            .slice(0, 3);
          
          console.log(`  🔍 Top cost contributors:`);
          topContributors.forEach(item => {
            console.log(`    • ${item.name}: $${item.cost.toFixed(2)} (${item.percentage}% × $${item.price_per_kg}/kg)`);
          });
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`  ❌ Failed to update cost for ${formula.formula_name}: ${error.message}`);
      }
    }
    
    // Calculate averages
    if (costSummary.total_formulas > 0) {
      costSummary.average_cost = costSummary.total_cost / costSummary.total_formulas;
    }
    
    console.log(`\\n🎉 Cost calculation complete!`);
    console.log(`📊 SUMMARY:`);
    console.log(`  • Formulas updated: ${updatedCount}`);
    console.log(`  • Average cost: $${costSummary.average_cost.toFixed(2)}/kg`);
    console.log(`  • Best coverage: ${costSummary.best_coverage.toFixed(1)}%`);
    console.log(`  • Total value: $${costSummary.total_cost.toFixed(2)}`);
    
    // Final board status check
    console.log('\\n📈 FINAL STATUS:');
    const { checkPricingStatus } = require('./check-pricing-status');
    await checkPricingStatus();
    
  } catch (error) {
    console.error('❌ Error calculating formula costs:', error.message);
    if (error.response?.data) {
      console.error('API Response:', error.response.data);
    }
  } finally {
    await pool.end();
  }
}

// Helper function to find best price match
function findBestPriceMatch(ingredientName, pricingLookup) {
  const name = ingredientName.toLowerCase();
  
  // Direct match
  if (pricingLookup[name]) {
    return pricingLookup[name];
  }
  
  // Partial matches
  for (const [key, pricing] of Object.entries(pricingLookup)) {
    if (name.includes(key) || key.includes(name)) {
      return pricing;
    }
  }
  
  // Special case mappings
  const specialMappings = {
    'water': 'di water',
    'benzyl alcohol-dha': 'benzyl alcohol-dha',
    'aloe vera gel juice (1x)': 'aloe vera gel juice (1x)',
    'caprylic/capric triglycerides': 'caprylic/capric triglycerides',
    'coco caprylate caprate': 'coco caprylate caprate',
    'olivem 1000': 'olivem 1000',
    'glyceryl stearate': 'glyceryl stearate'
  };
  
  if (specialMappings[name] && pricingLookup[specialMappings[name]]) {
    return pricingLookup[specialMappings[name]];
  }
  
  return null;
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
  
  calculateFormulaCosts(options);
}

module.exports = { calculateFormulaCosts };