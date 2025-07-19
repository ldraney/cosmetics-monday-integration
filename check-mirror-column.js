const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function checkMirrorColumn() {
  try {
    const testBoardId = '9625728737';
    const fortifyingItemId = '9625729143';
    const mirrorColumnId = 'lookup_mkt0fyfk'; // INCI Names mirror column
    
    console.log('🪞 Checking INCI Names mirror column...');
    
    const query = `
      query {
        items(ids: [${fortifyingItemId}]) {
          name
          column_values(ids: ["${mirrorColumnId}"]) {
            id
            type
            text
            value
          }
        }
      }
    `;
    
    const response = await monday.api(query);
    const item = response.data?.items?.[0];
    const mirrorColumn = item?.column_values?.[0];
    
    console.log(`Item: ${item?.name}`);
    console.log(`Mirror column type: ${mirrorColumn?.type}`);
    console.log(`Mirror text: ${mirrorColumn?.text || 'null'}`);
    console.log(`Mirror value: ${mirrorColumn?.value || 'null'}`);
    
    if (mirrorColumn?.text && mirrorColumn.text !== 'null') {
      console.log('\n✅ INCI Names are appearing in mirror column!');
      console.log(`INCI Data: ${mirrorColumn.text}`);
    } else {
      console.log('\n⚠️  INCI Names not showing yet - may need time to sync');
    }
    
    // Also check all columns to see current state
    console.log('\n📊 Checking all columns for Fortifying Cream Cleanser...');
    
    const allColumnsQuery = `
      query {
        items(ids: [${fortifyingItemId}]) {
          name
          column_values {
            id
            type
            text
            value
          }
        }
      }
    `;
    
    const allResponse = await monday.api(allColumnsQuery);
    const allItem = allResponse.data?.items?.[0];
    
    if (allItem?.column_values) {
      console.log('All column values:');
      allItem.column_values.forEach(col => {
        if (col.text && col.text !== 'null' && col.type !== 'name') {
          console.log(`  • ${col.id} (${col.type}): "${col.text}"`);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkMirrorColumn();