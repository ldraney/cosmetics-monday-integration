const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function getDetailedItemInfo() {
  try {
    const itemId = '9625729143'; // Fortifying Cream Cleanser
    
    console.log('🔍 Getting detailed info for Fortifying Cream Cleanser...');
    
    const query = `
      query {
        items(ids: [${itemId}]) {
          id
          name
          board {
            id
            name
          }
          column_values {
            id
            title
            type
            text
            value
          }
        }
      }
    `;
    
    const response = await monday.api(query);
    const item = response.data?.items?.[0];
    
    if (!item) {
      console.log('❌ Item not found');
      return;
    }
    
    console.log(`✅ Item: ${item.name} (ID: ${item.id})`);
    console.log(`📋 Board: ${item.board?.name} (ID: ${item.board?.id})`);
    
    console.log('\n📊 ALL COLUMN VALUES:');
    item.column_values.forEach(col => {
      console.log(`\n• ${col.title} (${col.type}) [ID: ${col.id}]`);
      console.log(`  Text: ${col.text}`);
      console.log(`  Value: ${col.value}`);
      
      // Special attention to board_relation columns
      if (col.type === 'board_relation') {
        console.log(`  🔗 THIS IS A BOARD RELATION COLUMN`);
        if (col.value && col.value !== 'null') {
          try {
            const parsed = JSON.parse(col.value);
            console.log(`  Parsed: ${JSON.stringify(parsed, null, 4)}`);
          } catch (e) {
            console.log(`  Could not parse as JSON`);
          }
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

getDetailedItemInfo();