const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function simpleCalculateFormulaCosts() {
  console.log('💰 SIMPLE FORMULA COST CALCULATOR...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const ingredientsBoardId = '9625733140'; // Ingredients Master Database
    const pricingColumnId = 'numeric_mkt0v0h6'; // Price per kg column
    
    console.log('📊 Step 1: Getting pricing data from Monday...');
    
    // Get all ingredient pricing from Monday
    const pricingQuery = `
      query {
        boards(ids: [${ingredientsBoardId}]) {
          items_page(limit: 500) {
            items {
              id
              name
              column_values(ids: ["${pricingColumnId}"]) {
                id
                type
                text
                value
              }
            }
          }
        }
      }
    `;
    
    const pricingResponse = await monday.api(pricingQuery);
    const mondayIngredients = pricingResponse.data?.boards?.[0]?.items_page?.items || [];
    
    // Create pricing lookup map
    const pricingMap = new Map();
    let ingredientsWithPricing = 0;
    
    console.log('Building pricing lookup...');
    mondayIngredients.forEach(ingredient => {
      const pricingColumn = ingredient.column_values?.[0];
      if (pricingColumn && pricingColumn.text && pricingColumn.text.trim() !== '') {
        const priceText = pricingColumn.text.trim();
        const priceValue = parseFloat(priceText.replace(/[^0-9.-]/g, ''));
        
        if (!isNaN(priceValue) && priceValue > 0) {
          pricingMap.set(ingredient.name.toLowerCase().trim(), {
            name: ingredient.name,
            pricePerKg: priceValue
          });
          ingredientsWithPricing++;
        }
      }
    });
    
    console.log(`✅ Found pricing for ${ingredientsWithPricing} ingredients\n`);
    
    console.log('📋 Step 2: Getting formula data from database...');
    
    // Get just a few formulas to start with
    const formulasQuery = `
      SELECT 
        f.id as formula_id,
        f.name as formula_name,
        f.version,
        f.status,
        json_agg(
          json_build_object(
            'ingredient_name', i.name,
            'percentage', fi.percentage
          ) ORDER BY fi.percentage DESC
        ) as ingredients
      FROM formulas f
      JOIN formula_ingredients fi ON f.id = fi.formula_id
      JOIN ingredients i ON fi.ingredient_id = i.id
      WHERE f.status = 'approved'
      GROUP BY f.id, f.name, f.version, f.status
      ORDER BY f.name
      LIMIT 5
    `;
    
    const formulasResult = await pool.query(formulasQuery);
    console.log(`✅ Analyzing ${formulasResult.rows.length} formulas\n`);
    
    console.log('💰 Step 3: Calculating costs...');
    console.log('================================\n');
    
    for (const formula of formulasResult.rows) {
      console.log(`🧪 ${formula.formula_name}`);
      console.log('=====================================');
      
      let totalCostPerKg = 0;
      let pricedPercentage = 0;
      let unpricedIngredients = [];
      let costBreakdown = [];
      
      for (const ingredient of formula.ingredients) {
        const cleanName = ingredient.ingredient_name.toLowerCase().trim();
        const pricingData = pricingMap.get(cleanName);
        
        if (pricingData) {
          // Calculate cost for this ingredient: (percentage/100) * price_per_kg
          const weightKg = ingredient.percentage / 100; // Percentage as decimal
          const ingredientCost = weightKg * pricingData.pricePerKg;
          
          totalCostPerKg += ingredientCost;
          pricedPercentage += ingredient.percentage;
          
          costBreakdown.push({
            name: ingredient.ingredient_name,
            percentage: ingredient.percentage,
            pricePerKg: pricingData.pricePerKg,
            cost: ingredientCost
          });
          
          console.log(`✅ ${ingredient.ingredient_name}: ${ingredient.percentage}% × $${pricingData.pricePerKg}/kg = $${ingredientCost.toFixed(4)}`);
        } else {
          unpricedIngredients.push(ingredient.ingredient_name);
          console.log(`❌ ${ingredient.ingredient_name}: ${ingredient.percentage}% - NO PRICING`);
        }
      }
      
      // Sort cost breakdown by cost (highest first)
      costBreakdown.sort((a, b) => b.cost - a.cost);
      
      const totalPercentage = formula.ingredients.reduce((sum, ing) => sum + ing.percentage, 0);
      const coverageRate = (pricedPercentage / totalPercentage) * 100;
      
      console.log(`\n📊 SUMMARY FOR ${formula.formula_name}:`);
      console.log(`   Total cost per kg: $${totalCostPerKg.toFixed(2)}`);
      console.log(`   Pricing coverage: ${coverageRate.toFixed(1)}% (${formula.ingredients.length - unpricedIngredients.length}/${formula.ingredients.length} ingredients)`);
      
      if (costBreakdown.length > 0) {
        console.log(`   Top 3 cost contributors:`);
        costBreakdown.slice(0, 3).forEach((item, index) => {
          console.log(`   ${index + 1}. ${item.name}: $${item.cost.toFixed(2)} (${item.percentage}% × $${item.pricePerKg}/kg)`);
        });
      }
      
      if (unpricedIngredients.length > 0) {
        console.log(`   Missing pricing: ${unpricedIngredients.join(', ')}`);
      }
      
      console.log('\n');
    }
    
    // Check for pricing issues
    console.log('🔍 PRICING ANALYSIS:');
    console.log('====================');
    
    const suspiciousPricing = [];
    pricingMap.forEach((data, key) => {
      // Flag water/basic ingredients that are over $10/kg
      if ((key.includes('water') || key.includes('glycerin')) && data.pricePerKg > 10) {
        suspiciousPricing.push(data);
      }
    });
    
    if (suspiciousPricing.length > 0) {
      console.log('⚠️  POTENTIALLY INCORRECT PRICING:');
      suspiciousPricing.forEach(item => {
        console.log(`   • ${item.name}: $${item.pricePerKg}/kg (seems high)`);
      });
      
      console.log('\n💡 RECOMMENDATIONS:');
      console.log('   • Review pricing for basic ingredients like water and glycerin');
      console.log('   • Water should typically be $0.001-$0.01/kg');
      console.log('   • Glycerin should typically be $2-$5/kg');
    }
    
  } catch (error) {
    console.error('❌ Error calculating formula costs:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

simpleCalculateFormulaCosts();