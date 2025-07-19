const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function examineConnectionColumn() {
  try {
    const boardId = '9625728737';
    
    console.log('🔍 Examining connection column on board', boardId);
    
    const query = `
      query {
        boards(ids: [${boardId}]) {
          name
          columns {
            id
            title
            type
            settings_str
            description
          }
        }
      }
    `;
    
    const response = await monday.api(query);
    const board = response.data?.boards?.[0];
    
    if (!board) {
      console.log('❌ Board not found');
      return;
    }
    
    console.log(`📋 Board: ${board.name}`);
    console.log('\nAll columns:');
    
    board.columns.forEach(col => {
      console.log(`  • ${col.title} (${col.type}) [ID: ${col.id}]`);
      if (col.settings_str) {
        console.log(`    Settings: ${col.settings_str}`);
      }
      if (col.description) {
        console.log(`    Description: ${col.description}`);
      }
    });
    
    // Find the ingredients connection column
    const connectionCol = board.columns.find(col => 
      col.title.toLowerCase().includes('ingredient') || 
      col.type === 'board_relation' ||
      col.type === 'connect_boards'
    );
    
    if (connectionCol) {
      console.log('\n🎯 FOUND CONNECTION COLUMN:');
      console.log(`   Title: ${connectionCol.title}`);
      console.log(`   ID: ${connectionCol.id}`);
      console.log(`   Type: ${connectionCol.type}`);
      console.log(`   Settings: ${connectionCol.settings_str}`);
      
      // Try to parse settings
      try {
        const settings = JSON.parse(connectionCol.settings_str);
        console.log('\n   Parsed Settings:');
        console.log(JSON.stringify(settings, null, 4));
      } catch (e) {
        console.log('   Could not parse settings as JSON');
      }
    } else {
      console.log('\n❌ No connection column found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

examineConnectionColumn();