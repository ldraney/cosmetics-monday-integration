const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function checkSpecificConnection() {
  try {
    const testBoardId = '9625728737';
    const connectionColumnId = 'board_relation_mkt08v2f';
    const formulaItemId = '9625729143'; // Fortifying Cream Cleanser
    
    console.log('🔍 Checking Fortifying Cream Cleanser connection specifically...');
    
    const query = `
      query {
        items(ids: [${formulaItemId}]) {
          name
          column_values(ids: ["${connectionColumnId}"]) {
            id
            text
            value
            type
          }
        }
      }
    `;
    
    const response = await monday.api(query);
    const item = response.data?.items?.[0];
    
    if (item) {
      console.log(`📋 Formula: ${item.name}`);
      
      const connectionValue = item.column_values?.[0];
      console.log(`Connection column:`);
      console.log(`  ID: ${connectionValue?.id}`);
      console.log(`  Type: ${connectionValue?.type}`);
      console.log(`  Text: ${connectionValue?.text}`);
      console.log(`  Value: ${connectionValue?.value}`);
      
      if (connectionValue?.value && connectionValue.value !== 'null') {
        console.log('\n✅ Connection found! Manual setup worked.');
        try {
          const parsed = JSON.parse(connectionValue.value);
          console.log(`Parsed value: ${JSON.stringify(parsed, null, 2)}`);
        } catch (e) {
          console.log('Could not parse value as JSON');
        }
      } else {
        console.log('\n❌ No connection value found yet.');
        console.log('\nThis could mean:');
        console.log('1. Connection is still processing (try again in 30 seconds)');
        console.log('2. Connection was not saved properly');
        console.log('3. Need to refresh/save the Monday board');
      }
      
    } else {
      console.log('❌ Formula item not found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkSpecificConnection();