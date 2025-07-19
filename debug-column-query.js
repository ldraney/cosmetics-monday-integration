const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function debugColumnQuery() {
  try {
    const testBoardId = '9625728737';
    
    console.log('🔍 Testing different query approaches...');
    
    // First test - simple query that we know works
    console.log('\n1. Testing basic query...');
    const basicQuery = `
      query {
        boards(ids: [${testBoardId}]) {
          name
          items_page(limit: 3) {
            items {
              id
              name
            }
          }
        }
      }
    `;
    
    const basicResponse = await monday.api(basicQuery);
    console.log(`Basic response has data: ${!!basicResponse.data}`);
    console.log(`Items found: ${basicResponse.data?.boards?.[0]?.items_page?.items?.length || 0}`);
    
    // Second test - add column_values
    console.log('\n2. Testing with column_values...');
    const columnQuery = `
      query {
        boards(ids: [${testBoardId}]) {
          items_page(limit: 1) {
            items {
              id
              name
              column_values {
                id
                type
              }
            }
          }
        }
      }
    `;
    
    const columnResponse = await monday.api(columnQuery);
    console.log(`Column response has data: ${!!columnResponse.data}`);
    
    if (!columnResponse.data) {
      console.log('❌ Column query failed');
      console.log('Full response:', JSON.stringify(columnResponse, null, 2));
    } else {
      console.log('✅ Column query worked');
      const item = columnResponse.data?.boards?.[0]?.items_page?.items?.[0];
      if (item) {
        console.log(`Item: ${item.name}`);
        console.log(`Columns found: ${item.column_values?.length || 0}`);
      }
    }
    
    // Third test - try specific item query
    console.log('\n3. Testing specific item query...');
    const itemQuery = `
      query {
        items(ids: [9625729143]) {
          id
          name
          column_values {
            id
            type
            title
          }
        }
      }
    `;
    
    const itemResponse = await monday.api(itemQuery);
    console.log(`Item response has data: ${!!itemResponse.data}`);
    
    if (!itemResponse.data) {
      console.log('❌ Item query failed');
      console.log('Full response:', JSON.stringify(itemResponse, null, 2));
    } else {
      console.log('✅ Item query worked');
      const item = itemResponse.data?.items?.[0];
      if (item) {
        console.log(`Item: ${item.name}`);
        console.log(`Columns found: ${item.column_values?.length || 0}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }
}

debugColumnQuery();