const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function checkExistingConnections() {
  try {
    const testBoardId = '9625728737';
    const connectionColumnId = 'board_relation_mkt08v2f';
    
    console.log('🔍 Checking for existing connections on TEST board...');
    
    const query = `
      query {
        boards(ids: [${testBoardId}]) {
          items_page(limit: 100) {
            items {
              id
              name
              column_values(ids: ["${connectionColumnId}"]) {
                id
                text
                value
                type
              }
            }
          }
        }
      }
    `;
    
    const response = await monday.api(query);
    const items = response.data?.boards?.[0]?.items_page?.items || [];
    
    console.log(`Found ${items.length} items on board`);
    
    let connectionsFound = 0;
    items.forEach(item => {
      const connectionValue = item.column_values?.[0];
      if (connectionValue?.value && connectionValue.value !== 'null' && connectionValue.value !== '{}') {
        connectionsFound++;
        console.log(`\n✅ ${item.name} has connection:`);
        console.log(`   Text: ${connectionValue.text}`);
        console.log(`   Value: ${connectionValue.value}`);
        
        try {
          const parsed = JSON.parse(connectionValue.value);
          console.log(`   Parsed: ${JSON.stringify(parsed, null, 2)}`);
        } catch (e) {
          console.log('   Could not parse value as JSON');
        }
      }
    });
    
    if (connectionsFound === 0) {
      console.log('\n❌ No existing connections found');
      console.log('\nThis suggests either:');
      console.log('1. The boards are not properly connected in Monday UI');
      console.log('2. The connection format is incorrect');
      console.log('3. There are permission issues');
      console.log('\n💡 Try manually connecting one item in Monday UI first');
    } else {
      console.log(`\n✅ Found ${connectionsFound} existing connections`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkExistingConnections();