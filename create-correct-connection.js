const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function createCorrectConnection() {
  try {
    console.log('🔗 Creating connection using Monday.com API documentation format...');
    
    const formulaBoardId = '9625728737';
    const formulaItemId = '9625729143'; // Fortifying Cream Cleanser
    const connectionColumnId = 'board_relation_mkt08v2f';
    const waterIngredientId = '9625733154'; // Water from ingredients board
    
    console.log(`📋 Formula Board: ${formulaBoardId}`);
    console.log(`🧴 Formula Item: ${formulaItemId} (Fortifying Cream Cleanser)`);
    console.log(`🔗 Connection Column: ${connectionColumnId}`);
    console.log(`💧 Water Ingredient: ${waterIngredientId}`);
    
    // Using the exact format from Monday.com documentation:
    // "connect_boards" : {"item_ids" : ["44332211", "11223344"]}
    
    const columnValues = {};
    columnValues[connectionColumnId] = {
      "item_ids": [waterIngredientId]
    };
    
    console.log('\n📝 Connection payload:');
    console.log(JSON.stringify(columnValues, null, 2));
    
    const mutation = `
      mutation {
        change_multiple_column_values(
          item_id: ${formulaItemId},
          board_id: ${formulaBoardId},
          column_values: "${JSON.stringify(JSON.stringify(columnValues)).slice(1, -1)}"
        ) {
          id
        }
      }
    `;
    
    console.log('\n🚀 Executing mutation...');
    console.log('Mutation:', mutation.substring(0, 200) + '...');
    
    const response = await monday.api(mutation);
    
    console.log('\n📥 Response:');
    console.log(JSON.stringify(response, null, 2));
    
    if (response.data?.change_multiple_column_values?.id) {
      console.log('\n✅ Mutation executed successfully!');
      
      // Wait a moment for Monday to process
      console.log('⏳ Waiting 3 seconds for Monday to process...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Verify the connection was created
      console.log('\n🔍 Verifying connection...');
      
      const verifyQuery = `
        query {
          items(ids: [${formulaItemId}]) {
            name
            column_values(ids: ["${connectionColumnId}"]) {
              id
              type
              text
              value
            }
          }
        }
      `;
      
      const verifyResponse = await monday.api(verifyQuery);
      const item = verifyResponse.data?.items?.[0];
      const connectionValue = item?.column_values?.[0];
      
      console.log(`Item: ${item?.name}`);
      console.log(`Connection text: ${connectionValue?.text}`);
      console.log(`Connection value: ${connectionValue?.value}`);
      
      if (connectionValue?.value && connectionValue.value !== 'null' && connectionValue.value !== '{}') {
        console.log('\n🎉 SUCCESS! Connection created!');
        try {
          const parsed = JSON.parse(connectionValue.value);
          console.log('Connected items:', parsed);
        } catch (e) {
          console.log('Raw value:', connectionValue.value);
        }
      } else {
        console.log('\n❌ Connection not visible yet');
        console.log('This could mean:');
        console.log('1. Still processing (check Monday UI)');
        console.log('2. Boards need manual connection first');
        console.log('3. Different format required');
      }
      
    } else {
      console.log('\n❌ Mutation failed');
      console.log('Response:', response);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

createCorrectConnection();