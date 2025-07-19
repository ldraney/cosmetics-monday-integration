const mondaySDK = require('monday-sdk-js');
const fs = require('fs');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function uploadRemainingPricing() {
  console.log('💰 Uploading remaining pricing data to Monday.com...\n');
  
  try {
    // Load pricing matches
    const pricingData = JSON.parse(fs.readFileSync('inflow-pricing-matches.json', 'utf8'));
    const matches = pricingData.matches;
    
    console.log(`📊 Found ${matches.length} pricing matches to process`);
    
    const ingredientsBoardId = process.env.INGREDIENTS_BOARD_ID;
    const pricingColumnId = 'numeric_mkt0v0h6';
    
    // Get all board items with pricing status
    const boardQuery = `
      query {
        boards(ids: [${ingredientsBoardId}]) {
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
    
    const boardResponse = await monday.api(boardQuery);
    const boardData = boardResponse.data?.boards?.[0];
    const boardItems = boardData?.items_page?.items || [];
    
    console.log(`📋 Found ${boardItems.length} items in Monday board`);
    
    // Filter items that need pricing
    const unpricedItems = boardItems.filter(item => {
      const priceColumn = item.column_values.find(cv => cv.id === pricingColumnId);
      return !priceColumn || !priceColumn.text || priceColumn.text === '' || priceColumn.text === '0';
    });
    
    console.log(`❌ ${unpricedItems.length} items still need pricing`);
    
    // Match and update
    let updatedCount = 0;
    let skippedCount = 0;
    
    for (const unpricedItem of unpricedItems) {
      // Skip "Task 1" item
      if (unpricedItem.name === 'Task 1') {
        continue;
      }
      
      // Find best match from pricing data
      const match = matches.find(m => {
        const dbName = m.database_ingredient_name.toLowerCase();
        const itemName = unpricedItem.name.toLowerCase();
        
        // Try various matching strategies
        return dbName === itemName ||
               dbName.includes(itemName) ||
               itemName.includes(dbName) ||
               // Handle special cases
               (dbName.includes('benzyl alcohol') && itemName.includes('benzyl alcohol')) ||
               (dbName.includes('aloe') && itemName.includes('aloe')) ||
               (dbName.includes('squalane') && itemName.includes('squalane')) ||
               (dbName.includes('tocopherol') && itemName.includes('tocopherol')) ||
               (dbName.includes('caprylic') && itemName.includes('caprylic')) ||
               (dbName.includes('glyceryl stearate') && itemName.includes('glyceryl stearate')) ||
               (dbName.includes('coco') && itemName.includes('coco'));
      });
      
      if (match) {
        try {
          const updateMutation = `
            mutation {
              change_column_value (
                board_id: ${ingredientsBoardId},
                item_id: ${unpricedItem.id},
                column_id: "${pricingColumnId}",
                value: "${match.estimated_cost_per_kg}"
              ) {
                id
              }
            }
          `;
          
          await monday.api(updateMutation);
          updatedCount++;
          console.log(`✅ ${unpricedItem.name} → $${match.estimated_cost_per_kg}/kg`);
          
          // Rate limiting
          if (updatedCount % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        } catch (error) {
          console.error(`❌ Failed to update ${unpricedItem.name}: ${error.message}`);
        }
      } else {
        skippedCount++;
        if (skippedCount <= 10) {
          console.log(`⚠️  No match found for: ${unpricedItem.name}`);
        }
      }
    }
    
    console.log('\n📊 SUMMARY:');
    console.log(`✅ Updated: ${updatedCount} items`);
    console.log(`⚠️  Skipped: ${skippedCount} items (no match found)`);
    
    // Final status check
    const { checkPricingStatus } = require('./check-pricing-status');
    console.log('\n📈 FINAL STATUS:');
    await checkPricingStatus();
    
  } catch (error) {
    console.error('❌ Error uploading pricing:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  uploadRemainingPricing();
}

module.exports = { uploadRemainingPricing };