const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function checkAllConnections() {
  try {
    const testBoardId = '9625728737';
    
    console.log('🔍 Checking ALL items for ANY board_relation connections...');
    
    const query = `
      query {
        boards(ids: [${testBoardId}]) {
          items_page(limit: 100) {
            items {
              id
              name
              column_values(ids: ["board_relation_mkt08v2f"]) {
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
    
    const response = await monday.api(query);
    const items = response.data?.boards?.[0]?.items_page?.items || [];
    
    console.log(`Checking ${items.length} items...`);
    
    let connectionsFound = 0;
    
    items.forEach(item => {
      const connection = item.column_values?.[0];
      
      // Check if there's ANY value (not null, not empty, not '{}')
      if (connection?.value && 
          connection.value !== 'null' && 
          connection.value !== '{}' && 
          connection.value !== '') {
        
        connectionsFound++;
        console.log(`\n✅ FOUND CONNECTION:`);
        console.log(`   Item: ${item.name} (ID: ${item.id})`);
        console.log(`   Text: ${connection.text}`);
        console.log(`   Value: ${connection.value}`);
        
        try {
          const parsed = JSON.parse(connection.value);
          console.log(`   Parsed JSON:`);
          console.log(JSON.stringify(parsed, null, 4));
        } catch (e) {
          console.log(`   Raw value (not valid JSON)`);
        }
      }
    });
    
    if (connectionsFound === 0) {
      console.log('\n❌ No connections found on any items');
      console.log('\nThis means either:');
      console.log('1. Manual connection was not saved/completed');
      console.log('2. There is a delay in Monday system');
      console.log('3. The connection setup needs different approach');
      
      // Show a few example items to verify we are getting data
      console.log('\nSample items checked:');
      items.slice(0, 3).forEach(item => {
        const connection = item.column_values?.[0];
        console.log(`  • ${item.name}: value="${connection?.value || 'null'}"`);
      });
      
    } else {
      console.log(`\n🎉 Found ${connectionsFound} connections total!`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAllConnections();