const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function checkMondayINCIBoard() {
  try {
    const inciBoardId = '9625740593'; // INCI Master Database
    
    console.log('🔍 Checking Monday INCI Master Database board...');
    
    const query = `
      query {
        boards(ids: [${inciBoardId}]) {
          name
          columns {
            id
            title
            type
          }
          items_page(limit: 50) {
            items {
              id
              name
              column_values {
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
    const board = response.data?.boards?.[0];
    
    if (!board) {
      console.log('❌ INCI board not found');
      return;
    }
    
    console.log(`📋 Board: ${board.name}`);
    console.log(`📊 Found ${board.items_page?.items?.length || 0} INCI items`);
    
    console.log('\n📊 INCI Board Columns:');
    board.columns.forEach(col => {
      console.log(`   • ${col.title} (${col.type}) [ID: ${col.id}]`);
    });
    
    console.log('\n📋 Sample INCI Items:');
    board.items_page?.items?.slice(0, 10).forEach(item => {
      console.log(`   • ${item.name} (ID: ${item.id})`);
    });
    
    // Check if there are any connections to ingredients board
    const connectionColumns = board.columns.filter(col => 
      col.type === 'board_relation' || col.title.toLowerCase().includes('ingredient')
    );
    
    console.log('\n🔗 Connection columns found:');
    if (connectionColumns.length > 0) {
      connectionColumns.forEach(col => {
        console.log(`   • ${col.title} (${col.type}) [ID: ${col.id}]`);
      });
    } else {
      console.log('   No connection columns found - needs setup');
    }
    
    return {
      board,
      connectionColumns,
      inciItems: board.items_page?.items || []
    };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    return null;
  }
}

checkMondayINCIBoard();