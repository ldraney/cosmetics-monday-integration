const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function showPricingMatches() {
  console.log('🔍 ANALYZING PRICING MATCHES...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const ingredientsBoardId = '9625733140'; // Ingredients Master Database
    const pricingColumnId = 'numeric_mkt0v0h6'; // Price per kg column
    
    // Get all ingredient pricing from Monday
    console.log('📊 Getting pricing data from Monday...');
    
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
    
    // Create pricing lookup map and show what has pricing
    const pricingMap = new Map();
    const pricedIngredients = [];
    
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
          pricedIngredients.push({
            name: ingredient.name,
            price: priceValue
          });
        }
      }
    });
    
    console.log(`✅ Found ${pricedIngredients.length} ingredients with pricing on Monday\n`);
    
    // Show some examples of priced ingredients
    console.log('💰 SAMPLE PRICED INGREDIENTS:');
    console.log('============================');
    pricedIngredients
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 20)
      .forEach(ingredient => {
        console.log(`• ${ingredient.name}: $${ingredient.price}/kg`);
      });
    
    // Now get ingredients from the Baby Body Lotion formula and try to match
    const formulaQuery = `
      SELECT i.name as ingredient_name
      FROM formulas f
      JOIN formula_ingredients fi ON f.id = fi.formula_id
      JOIN ingredients i ON fi.ingredient_id = i.id
      WHERE f.name LIKE '%Baby Body Lotion%'
      ORDER BY fi.percentage DESC
    `;
    
    const formulaResult = await pool.query(formulaQuery);
    
    console.log('\n🔍 MATCHING ANALYSIS FOR BABY BODY LOTION:');
    console.log('==========================================');
    
    formulaResult.rows.forEach(row => {
      const ingredientName = row.ingredient_name;
      const cleanName = ingredientName.toLowerCase().trim();
      
      // Try exact match
      let match = pricingMap.get(cleanName);
      let matchType = 'exact';
      
      // Try partial matches
      if (!match) {
        for (const [key, value] of pricingMap.entries()) {
          if (key.includes(cleanName) || cleanName.includes(key)) {
            match = value;
            matchType = 'partial';
            break;
          }
        }
      }
      
      if (match) {
        console.log(`✅ ${ingredientName}`);
        console.log(`   → Matched with "${match.name}" (${matchType}) - $${match.price}/kg`);
      } else {
        console.log(`❌ ${ingredientName}`);
        console.log(`   → No pricing match found`);
        
        // Try to suggest similar names
        const suggestions = pricedIngredients
          .filter(p => {
            const pName = p.name.toLowerCase();
            const iName = cleanName;
            return pName.includes(iName.split(' ')[0]) || iName.includes(pName.split(' ')[0]);
          })
          .slice(0, 3);
          
        if (suggestions.length > 0) {
          console.log(`   💡 Similar priced ingredients:`);
          suggestions.forEach(s => console.log(`      • ${s.name}`));
        }
      }
      console.log('');
    });
    
    // Show the proper pricing lookup that should work
    console.log('🔧 RECOMMENDED PRICING LOOKUP FUNCTION:');
    console.log('======================================');
    console.log('The issue is that ingredient names need better matching logic');
    
  } catch (error) {
    console.error('❌ Error analyzing pricing matches:', error.message);
  } finally {
    await pool.end();
  }
}

showPricingMatches();