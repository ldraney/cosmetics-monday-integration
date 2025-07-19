const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function getItemViaBoard() {
  try {
    const testBoardId = '9625728737';
    const targetItemId = '9625729143';
    
    console.log('🔍 Getting Fortifying Cream Cleanser via board query...');
    
    const query = `
      query {
        boards(ids: [${testBoardId}]) {
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
    const items = response.data?.boards?.[0]?.items_page?.items || [];
    
    const targetItem = items.find(item => item.id === targetItemId);
    
    if (!targetItem) {
      console.log(`❌ Item ${targetItemId} not found in board items`);
      console.log('Available items:');
      items.slice(0, 3).forEach(item => {
        console.log(`  • ${item.name} (ID: ${item.id})`);
      });
      return;
    }
    
    console.log(`✅ Found: ${targetItem.name} (ID: ${targetItem.id})`);
    
    console.log('\n📊 ALL COLUMN VALUES:');
    targetItem.column_values.forEach(col => {
      console.log(`\n• ${col.title} (${col.type}) [ID: ${col.id}]`);
      console.log(`  Text: ${col.text || 'null'}`);
      console.log(`  Value: ${col.value || 'null'}`);
      
      // Special attention to board_relation columns
      if (col.type === 'board_relation') {
        console.log(`  🔗 THIS IS THE BOARD RELATION COLUMN!`);
        if (col.value && col.value !== 'null' && col.value !== '{}') {
          console.log(`  ✅ HAS CONNECTION VALUE!`);
          try {
            const parsed = JSON.parse(col.value);
            console.log(`  Parsed: ${JSON.stringify(parsed, null, 4)}`);
          } catch (e) {
            console.log(`  Raw value (not JSON): ${col.value}`);
          }
        } else {
          console.log(`  ❌ No connection value`);
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

getItemViaBoard();