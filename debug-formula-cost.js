const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function debugFormulaCost() {
  console.log('🔍 DEBUGGING FORMULA COST CALCULATION...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const ingredientsBoardId = '9625733140'; // Ingredients Master Database
    const pricingColumnId = 'numbers_17sjtj'; // Price per kg column
    
    // Get all ingredient pricing from Monday
    console.log('📊 Getting all pricing data...');
    
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
    
    // Create pricing lookup and show expensive ingredients
    console.log('💰 EXPENSIVE INGREDIENTS (>$50/kg):');
    console.log('===================================');
    
    const expensiveIngredients = [];
    
    mondayIngredients.forEach(ingredient => {
      const pricingColumn = ingredient.column_values?.[0];
      if (pricingColumn && pricingColumn.text && pricingColumn.text.trim() !== '') {
        const priceText = pricingColumn.text.trim();
        const priceValue = parseFloat(priceText.replace(/[^0-9.-]/g, ''));
        
        if (!isNaN(priceValue) && priceValue > 50) {
          expensiveIngredients.push({
            name: ingredient.name,
            price: priceValue,
            id: ingredient.id
          });
        }
      }
    });
    
    expensiveIngredients
      .sort((a, b) => b.price - a.price)
      .forEach(ingredient => {
        console.log(`• ${ingredient.name}: $${ingredient.price}/kg`);
      });
    
    // Now let's look at a specific formula that showed high cost
    console.log('\n📋 DEBUGGING "Baby Body Lotion/ EveryAge" FORMULA:');
    console.log('================================================');
    
    const formulaQuery = `
      SELECT 
        f.id as formula_id,
        f.name as formula_name,
        SUM(fi.percentage) as total_percentage,
        json_agg(
          json_build_object(
            'ingredient_name', i.name,
            'percentage', fi.percentage
          ) ORDER BY fi.percentage DESC
        ) as ingredients
      FROM formulas f
      JOIN formula_ingredients fi ON f.id = fi.formula_id
      JOIN ingredients i ON fi.ingredient_id = i.id
      WHERE f.name LIKE '%Baby Body Lotion%'
      GROUP BY f.id, f.name
    `;
    
    const formulaResult = await pool.query(formulaQuery);
    
    if (formulaResult.rows.length > 0) {
      const formula = formulaResult.rows[0];
      console.log(`Formula: ${formula.formula_name}`);
      console.log(`Total percentage: ${formula.total_percentage}%\n`);
      
      console.log('Ingredients breakdown:');
      
      // Create pricing lookup map
      const pricingMap = new Map();
      mondayIngredients.forEach(ingredient => {
        const pricingColumn = ingredient.column_values?.[0];
        if (pricingColumn && pricingColumn.text && pricingColumn.text.trim() !== '') {
          const priceText = pricingColumn.text.trim();
          const priceValue = parseFloat(priceText.replace(/[^0-9.-]/g, ''));
          
          if (!isNaN(priceValue) && priceValue > 0) {
            pricingMap.set(ingredient.name.toLowerCase().trim(), {
              name: ingredient.name,
              price: priceValue
            });
          }
        }
      });
      
      let totalCost = 0;
      
      formula.ingredients.forEach(ingredient => {
        const cleanName = ingredient.ingredient_name.toLowerCase().trim();
        
        // Try to find pricing
        let pricing = pricingMap.get(cleanName);
        
        // If not found, try partial matches
        if (!pricing) {
          for (const [key, value] of pricingMap.entries()) {
            if (key.includes(cleanName) || cleanName.includes(key)) {
              pricing = value;
              break;
            }
          }
        }
        
        if (pricing) {
          const ingredientCost = (ingredient.percentage / 100) * pricing.price;
          totalCost += ingredientCost;
          
          console.log(`• ${ingredient.ingredient_name}: ${ingredient.percentage}% × $${pricing.price}/kg = $${ingredientCost.toFixed(2)}`);
          console.log(`  (Matched with Monday ingredient: "${pricing.name}")`);
        } else {
          console.log(`• ${ingredient.ingredient_name}: ${ingredient.percentage}% - NO PRICING FOUND`);
        }
      });
      
      console.log(`\nTotal calculated cost: $${totalCost.toFixed(2)}/kg`);
      
      // Check if the high cost is from a mismatched ingredient
      const highestCostIngredient = formula.ingredients
        .map(ingredient => {
          const cleanName = ingredient.ingredient_name.toLowerCase().trim();
          let pricing = pricingMap.get(cleanName);
          
          if (!pricing) {
            for (const [key, value] of pricingMap.entries()) {
              if (key.includes(cleanName) || cleanName.includes(key)) {
                pricing = value;
                break;
              }
            }
          }
          
          if (pricing) {
            return {
              ingredient: ingredient.ingredient_name,
              percentage: ingredient.percentage,
              price: pricing.price,
              cost: (ingredient.percentage / 100) * pricing.price,
              matchedWith: pricing.name
            };
          }
          return null;
        })
        .filter(Boolean)
        .sort((a, b) => b.cost - a.cost)[0];
      
      if (highestCostIngredient) {
        console.log(`\n🔥 HIGHEST COST CONTRIBUTOR:`);
        console.log(`Ingredient: ${highestCostIngredient.ingredient}`);
        console.log(`Matched with: ${highestCostIngredient.matchedWith}`);
        console.log(`Price: $${highestCostIngredient.price}/kg`);
        console.log(`Percentage: ${highestCostIngredient.percentage}%`);
        console.log(`Cost contribution: $${highestCostIngredient.cost.toFixed(2)}`);
        
        if (highestCostIngredient.price > 50) {
          console.log(`⚠️  This seems unusually expensive - check if this pricing is correct!`);
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error debugging formula cost:', error.message);
  } finally {
    await pool.end();
  }
}

debugFormulaCost();