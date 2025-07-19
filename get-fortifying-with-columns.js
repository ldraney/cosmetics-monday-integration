const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function getFormulaWithColumns() {
  try {
    const testBoardId = '9625728737';
    
    console.log('🔍 Getting Fortifying Cream Cleanser with ALL column data...');
    
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
    
    // Debug response structure
    console.log('📥 Response structure check:');
    console.log(`Has data: ${!!response.data}`);
    console.log(`Has boards: ${!!response.data?.boards}`);
    console.log(`Boards length: ${response.data?.boards?.length}`);
    
    const board = response.data?.boards?.[0];
    if (!board) {
      console.log('❌ No board found in response');
      return;
    }
    
    console.log(`📋 Board: ${board.name}`);
    console.log(`Has items_page: ${!!board.items_page}`);
    console.log(`Has items: ${!!board.items_page?.items}`);
    
    const items = board.items_page?.items || [];
    console.log(`📊 Found ${items.length} items`);
    
    // Find Fortifying Cream Cleanser
    const fortifyingItem = items.find(item => 
      item.name && item.name.toLowerCase().includes('fortifying')
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
    console.log(`Has column_values: ${!!fortifyingItem.column_values}`);
    console.log(`Column count: ${fortifyingItem.column_values?.length || 0}`);
    
    if (!fortifyingItem.column_values || fortifyingItem.column_values.length === 0) {
      console.log('❌ No column values found - trying different query...');
      return;
    }
    
    console.log('\n📊 ALL COLUMNS:');
    fortifyingItem.column_values.forEach((col, index) => {
      console.log(`\n${index + 1}. ${col.title || 'No title'} (${col.type || 'No type'}) [ID: ${col.id || 'No ID'}]`);
      console.log(`   Text: ${col.text || 'null'}`);
      console.log(`   Value: ${col.value || 'null'}`);
      
      // Highlight the board_relation column
      if (col.type === 'board_relation') {
        console.log(`   🔗 THIS IS THE BOARD RELATION COLUMN!`);
        console.log(`   Column ID: ${col.id}`);
        console.log(`   Title: ${col.title}`);
        
        if (col.value && col.value !== 'null' && col.value !== '{}') {
          console.log(`   ✅ HAS CONNECTION VALUE!`);
          try {
            const parsed = JSON.parse(col.value);
            console.log(`   Parsed: ${JSON.stringify(parsed, null, 4)}`);
          } catch (e) {
            console.log(`   Raw value: ${col.value}`);
          }
        } else {
          console.log(`   ❌ No connection value`);
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

getFormulaWithColumns();