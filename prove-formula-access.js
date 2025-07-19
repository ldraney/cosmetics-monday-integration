const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function getFormulaWithColumns() {
  try {
    const testBoardId = '9625728737';
    
    console.log('🔍 Getting Fortifying Cream Cleanser with ALL its column data...');
    
    const query = `
      query {
        boards(ids: [${testBoardId}]) {
          name
          items_page(limit: 100) {
            items {
              id
              name
              column_values {
                id
                title
                type
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
    console.log(`📊 Found ${items.length} items`);
    
    // Find Fortifying Cream Cleanser
    const fortifyingItem = items.find(item => 
      item.name.toLowerCase().includes('fortifying')
    );
    
    if (!fortifyingItem) {
      console.log('❌ Fortifying Cream Cleanser not found');
      console.log('Available items:');
      items.slice(0, 5).forEach(item => {
        console.log(`  • ${item.name} (ID: ${item.id})`);
      });
      return;
    }
    
    console.log(`\n✅ FOUND: ${fortifyingItem.name} (ID: ${fortifyingItem.id})`);
    
    console.log('\n📊 ALL COLUMNS:');
    fortifyingItem.column_values.forEach(col => {
      console.log(`\n• ${col.title} (${col.type}) [ID: ${col.id}]`);
      console.log(`  Text: ${col.text || 'null'}`);
      console.log(`  Value: ${col.value || 'null'}`);
      
      // Highlight the board_relation column
      if (col.type === 'board_relation') {
        console.log(`  🔗 THIS IS THE BOARD RELATION COLUMN!`);
        console.log(`  Column ID: ${col.id}`);
        console.log(`  Title: ${col.title}`);
      }
    });
    
    return fortifyingItem;
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

getFormulaWithColumns();