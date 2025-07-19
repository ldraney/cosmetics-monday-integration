const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function verifyWorkingConnections() {
  try {
    const testBoardId = '9625728737';
    const connectionColumnId = 'board_relation_mkt08v2f';
    
    console.log('🔍 VERIFYING ALL CONNECTIONS USING CORRECT FORMAT...');
    console.log('='.repeat(60));
    
    // Use the correct BoardRelationValue format
    const query = `
      query {
        boards(ids: [${testBoardId}]) {
          items_page(limit: 100) {
            items {
              id
              name
              column_values(ids: ["${connectionColumnId}"]) {
                id
                type
                text
                value
                ... on BoardRelationValue {
                  linked_item_ids
                  linked_items {
                    id
                    name
                  }
                  display_value
                }
              }
            }
          }
        }
      }
    `;
    
    const response = await monday.api(query);
    const items = response.data?.boards?.[0]?.items_page?.items || [];
    
    console.log(`📊 Checking ${items.length} items for connections...\n`);
    
    let connectionsFound = 0;
    let totalConnectedItems = 0;
    
    items.forEach(item => {
      const connection = item.column_values?.[0];
      
      if (connection?.linked_item_ids && connection.linked_item_ids.length > 0) {
        connectionsFound++;
        totalConnectedItems += connection.linked_item_ids.length;
        
        console.log(`✅ ${item.name} (ID: ${item.id})`);
        console.log(`   Connected to ${connection.linked_item_ids.length} ingredients:`);
        
        connection.linked_items?.forEach(linkedItem => {
          console.log(`   • ${linkedItem.name} (ID: ${linkedItem.id})`);
        });
        
        console.log(`   Display: "${connection.display_value}"`);
        console.log('');
      }
    });
    
    console.log('📊 SUMMARY:');
    console.log(`✅ Formulas with connections: ${connectionsFound}`);
    console.log(`🔗 Total ingredient connections: ${totalConnectedItems}`);
    
    if (connectionsFound === 0) {
      console.log('❌ No connections found');
    } else {
      console.log('\n🎉 SUCCESS! Connections are working properly!');
    }
    
    return {
      connectionsFound,
      totalConnectedItems,
      items
    };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

verifyWorkingConnections();