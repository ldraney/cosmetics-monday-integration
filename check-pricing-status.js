const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function checkPricingStatus() {
  console.log('💰 Checking pricing status on Monday boards...\n');
  
  const ingredientsBoardId = process.env.INGREDIENTS_BOARD_ID;
  const pricingColumnId = 'numeric_mkt0v0h6'; // Price per KG column
  
  try {
    // Query all items with pricing column
    const query = `
      query {
        boards(ids: [${ingredientsBoardId}]) {
          name
          items_page(limit: 500) {
            items {
              id
              name
              column_values(ids: ["${pricingColumnId}"]) {
                id
                text
                value
              }
            }
          }
        }
      }
    `;
    
    const response = await monday.api(query);
    const board = response.data?.boards?.[0];
    const items = board?.items_page?.items || [];
    
    console.log(`📋 Board: ${board?.name}`);
    console.log(`📊 Total items: ${items.length}`);
    
    // Count items with pricing
    const itemsWithPricing = items.filter(item => {
      const priceColumn = item.column_values.find(cv => cv.id === pricingColumnId);
      return priceColumn && priceColumn.text && priceColumn.text !== '' && priceColumn.text !== '0';
    });
    
    console.log(`💰 Items with pricing: ${itemsWithPricing.length}`);
    console.log(`📈 Coverage: ${((itemsWithPricing.length / items.length) * 100).toFixed(1)}%\n`);
    
    // Show sample of priced items
    console.log('🔍 Sample of priced items:');
    itemsWithPricing.slice(0, 10).forEach((item, i) => {
      const priceColumn = item.column_values.find(cv => cv.id === pricingColumnId);
      console.log(`${i + 1}. ${item.name}: $${priceColumn.text}/kg`);
    });
    
    // Show some unpriced items
    const unpricedItems = items.filter(item => {
      const priceColumn = item.column_values.find(cv => cv.id === pricingColumnId);
      return !priceColumn || !priceColumn.text || priceColumn.text === '' || priceColumn.text === '0';
    });
    
    if (unpricedItems.length > 0) {
      console.log('\n❌ Sample of unpriced items:');
      unpricedItems.slice(0, 10).forEach((item, i) => {
        console.log(`${i + 1}. ${item.name}`);
      });
    }
    
    return {
      total: items.length,
      priced: itemsWithPricing.length,
      unpriced: unpricedItems.length
    };
    
  } catch (error) {
    console.error('❌ Error checking pricing status:', error.message);
    return null;
  }
}

// Run if called directly
if (require.main === module) {
  checkPricingStatus();
}

module.exports = { checkPricingStatus };