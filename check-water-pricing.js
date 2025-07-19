const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function checkWaterPricing() {
  console.log('🔍 CHECKING WATER PRICING ISSUE...\n');
  
  try {
    const ingredientsBoardId = '9625733140'; // Ingredients Master Database
    const pricingColumnId = 'numbers_17sjtj'; // Price per kg column
    
    // Get all water-related ingredients
    const waterQuery = `
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
    
    const response = await monday.api(waterQuery);
    const ingredients = response.data?.boards?.[0]?.items_page?.items || [];
    
    // Find water-related ingredients
    const waterIngredients = ingredients.filter(ingredient => {
      const name = ingredient.name.toLowerCase();
      return name.includes('water') || name.includes('aqua') || name === 'di water' || name === 'water';
    });
    
    console.log('💧 WATER-RELATED INGREDIENTS:');
    console.log('================================');
    
    waterIngredients.forEach(ingredient => {
      const pricingColumn = ingredient.column_values?.[0];
      const priceText = pricingColumn?.text?.trim() || 'No pricing';
      
      console.log(`• ${ingredient.name}`);
      console.log(`  Price: ${priceText}`);
      console.log(`  ID: ${ingredient.id}`);
      console.log('');
    });
    
    // Check if water has unrealistic pricing
    const problematicWater = waterIngredients.filter(ingredient => {
      const pricingColumn = ingredient.column_values?.[0];
      if (pricingColumn && pricingColumn.text) {
        const price = parseFloat(pricingColumn.text.replace(/[^0-9.-]/g, ''));
        return !isNaN(price) && price > 10; // Water should be very cheap
      }
      return false;
    });
    
    if (problematicWater.length > 0) {
      console.log('⚠️  PRICING ISSUES FOUND:');
      console.log('========================');
      
      problematicWater.forEach(ingredient => {
        const pricingColumn = ingredient.column_values?.[0];
        const price = parseFloat(pricingColumn.text.replace(/[^0-9.-]/g, ''));
        console.log(`🔴 ${ingredient.name}: $${price}/kg (seems too high for water)`);
      });
      
      console.log('\n💡 RECOMMENDATION:');
      console.log('Water should typically cost $0.001-$0.01 per kg');
      console.log('Consider updating these prices for accurate formula costing');
    } else {
      console.log('✅ Water pricing looks reasonable');
    }
    
    // Show most expensive ingredients for context
    console.log('\n💰 TOP 10 MOST EXPENSIVE INGREDIENTS:');
    console.log('====================================');
    
    const expensiveIngredients = ingredients
      .map(ingredient => {
        const pricingColumn = ingredient.column_values?.[0];
        if (pricingColumn && pricingColumn.text) {
          const price = parseFloat(pricingColumn.text.replace(/[^0-9.-]/g, ''));
          if (!isNaN(price) && price > 0) {
            return { name: ingredient.name, price: price };
          }
        }
        return null;
      })
      .filter(Boolean)
      .sort((a, b) => b.price - a.price)
      .slice(0, 10);
    
    expensiveIngredients.forEach((ingredient, index) => {
      console.log(`${index + 1}. ${ingredient.name}: $${ingredient.price}/kg`);
    });
    
  } catch (error) {
    console.error('❌ Error checking water pricing:', error.message);
  }
}

checkWaterPricing();