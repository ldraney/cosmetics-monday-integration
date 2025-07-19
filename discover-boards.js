const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();

async function discoverBoards() {
  console.log('🔍 DISCOVERING MONDAY.COM BOARDS AND CONNECTIONS');
  console.log('================================================\n');
  
  if (!process.env.MONDAY_API_TOKEN || process.env.MONDAY_API_TOKEN === 'your_monday_api_token_here') {
    console.error('❌ Please set your actual MONDAY_API_TOKEN in the .env file');
    console.error('You can get your token from: https://monday.com/developers/v2');
    return;
  }
  
  monday.setToken(process.env.MONDAY_API_TOKEN);
  
  try {
    // Test API connection first
    const meQuery = `query { me { id name email } }`;
    const meResponse = await monday.api(meQuery);
    
    if (!meResponse.data?.me) {
      console.error('❌ Invalid API token or connection failed');
      return;
    }
    
    console.log(`✅ Connected as: ${meResponse.data.me.name} (${meResponse.data.me.email})\n`);
    
    // Get all boards with detailed information
    console.log('📋 DISCOVERING ALL BOARDS...\n');
    
    const allBoardsQuery = `
      query {
        boards(limit: 100) {
          id
          name
          description
          state
          workspace {
            id
            name
          }
          columns {
            id
            title
            type
            settings_str
          }
        }
      }
    `;
    
    const boardsResponse = await monday.api(allBoardsQuery);
    const allBoards = boardsResponse.data.boards;
    
    if (!allBoards || allBoards.length === 0) {
      console.log('❌ No boards found or no access to boards');
      return;
    }
    
    console.log(`Found ${allBoards.length} total boards\n`);
    
    // Filter and categorize boards
    const cosmeticsBoards = allBoards.filter(board => 
      board.name.toLowerCase().includes('cosmetic') ||
      board.name.toLowerCase().includes('formula') ||
      board.name.toLowerCase().includes('ingredient') ||
      board.name.toLowerCase().includes('inci') ||
      board.name.toLowerCase().includes('test') ||
      board.name.toLowerCase().includes('pricing')
    );
    
    if (cosmeticsBoards.length === 0) {
      console.log('🔍 No cosmetics-related boards found. Here are all available boards:');
      allBoards.forEach(board => {
        console.log(`  • ${board.name} (ID: ${board.id}) - Workspace: ${board.workspace?.name || 'No workspace'}`);
      });
      return;
    }
    
    console.log(`🧪 COSMETICS-RELATED BOARDS (${cosmeticsBoards.length} found):`);
    console.log('='.repeat(70));
    
    for (const board of cosmeticsBoards) {
      console.log(`\n📋 ${board.name}`);
      console.log(`   ID: ${board.id}`);
      console.log(`   State: ${board.state}`);
      console.log(`   Workspace: ${board.workspace?.name || 'No workspace'}`);
      console.log(`   Description: ${board.description || 'No description'}`);
      
      // Analyze columns for connections and mirrors
      const connectionColumns = board.columns.filter(col => 
        col.type === 'dependency' || 
        col.type === 'link' || 
        col.type === 'mirror' ||
        col.title.toLowerCase().includes('connect') ||
        col.title.toLowerCase().includes('link') ||
        col.title.toLowerCase().includes('ingredient') ||
        col.title.toLowerCase().includes('inci') ||
        col.title.toLowerCase().includes('formula')
      );
      
      if (connectionColumns.length > 0) {
        console.log(`   🔗 Connection/Mirror columns (${connectionColumns.length}):`);
        connectionColumns.forEach(col => {
          console.log(`      • ${col.title} (${col.type}) [ID: ${col.id}]`);
          
          // Parse settings to understand connections
          if (col.settings_str) {
            try {
              const settings = JSON.parse(col.settings_str);
              if (settings.boardIds && col.type === 'dependency') {
                console.log(`        → Connected to boards: ${settings.boardIds.join(', ')}`);
              } else if (settings.mirrorBoardId && col.type === 'mirror') {
                console.log(`        → Mirrors from board: ${settings.mirrorBoardId}`);
                if (settings.mirrorColumnId) {
                  console.log(`        → Mirrors column: ${settings.mirrorColumnId}`);
                }
              }
            } catch (e) {
              // Settings parsing failed
            }
          }
        });
      }
      
      // Show all columns for TEST board specifically
      if (board.name.toLowerCase().includes('test')) {
        console.log(`   📊 ALL COLUMNS in ${board.name}:`);
        board.columns.forEach((col, index) => {
          console.log(`      ${index + 1}. ${col.title} (${col.type}) [ID: ${col.id}]`);
        });
      }
    }
    
    // Find TEST board specifically
    const testBoard = cosmeticsBoards.find(board => 
      board.name.toLowerCase().includes('test')
    );
    
    if (testBoard) {
      console.log(`\n🎯 DETAILED ANALYSIS OF TEST BOARD: ${testBoard.name}`);
      console.log('='.repeat(70));
      console.log(`Board ID: ${testBoard.id}`);
      
      // Get sample items from TEST board
      try {
        const testItemsQuery = `
          query {
            boards(ids: [${testBoard.id}]) {
              items(limit: 5) {
                id
                name
                column_values {
                  id
                  title
                  text
                  value
                  type
                }
              }
            }
          }
        `;
        
        const itemsResponse = await monday.api(testItemsQuery);
        const items = itemsResponse.data.boards[0]?.items || [];
        
        if (items.length > 0) {
          console.log(`\n📊 Sample items from ${testBoard.name}:`);
          items.forEach((item, index) => {
            console.log(`  ${index + 1}. ${item.name}`);
            
            // Show connection and mirror column values
            const relevantValues = item.column_values.filter(cv => 
              cv.type === 'dependency' || 
              cv.type === 'mirror' || 
              cv.title.toLowerCase().includes('ingredient') ||
              cv.title.toLowerCase().includes('inci')
            );
            
            relevantValues.forEach(cv => {
              console.log(`     ${cv.title} (${cv.type}): ${cv.text || 'No value'}`);
              if (cv.value && cv.value !== '{}') {
                try {
                  const parsed = JSON.parse(cv.value);
                  if (parsed.linkedPulseIds && parsed.linkedPulseIds.length > 0) {
                    console.log(`       → Linked to items: ${parsed.linkedPulseIds.join(', ')}`);
                  }
                } catch (e) {
                  // Value parsing failed
                }
              }
            });
          });
        }
      } catch (error) {
        console.log(`❌ Could not fetch items from ${testBoard.name}: ${error.message}`);
      }
    }
    
    // Look for ingredient and INCI master databases
    const ingredientBoards = allBoards.filter(board => 
      board.name.toLowerCase().includes('ingredient') && 
      board.name.toLowerCase().includes('master')
    );
    
    const inciBoards = allBoards.filter(board => 
      board.name.toLowerCase().includes('inci') && 
      board.name.toLowerCase().includes('master')
    );
    
    if (ingredientBoards.length > 0) {
      console.log(`\n🧪 INGREDIENTS MASTER DATABASES:`);
      ingredientBoards.forEach(board => {
        console.log(`  • ${board.name} (ID: ${board.id})`);
      });
    }
    
    if (inciBoards.length > 0) {
      console.log(`\n🧬 INCI MASTER DATABASES:`);
      inciBoards.forEach(board => {
        console.log(`  • ${board.name} (ID: ${board.id})`);
      });
    }
    
    // Summary and recommendations
    console.log(`\n📋 SUMMARY & NEXT STEPS`);
    console.log('='.repeat(70));
    
    if (testBoard) {
      console.log(`✅ Found TEST board: ${testBoard.name} (ID: ${testBoard.id})`);
      
      const mirrorColumns = testBoard.columns.filter(col => col.type === 'mirror');
      const dependencyColumns = testBoard.columns.filter(col => col.type === 'dependency');
      
      console.log(`📊 Mirror columns: ${mirrorColumns.length}`);
      console.log(`🔗 Dependency columns: ${dependencyColumns.length}`);
      
      if (mirrorColumns.length > 0) {
        console.log(`\n🪞 Mirror columns in ${testBoard.name}:`);
        mirrorColumns.forEach(col => {
          console.log(`  • ${col.title} (mirrors data from another board)`);
        });
      }
      
      if (dependencyColumns.length > 0) {
        console.log(`\n🔗 Dependency columns in ${testBoard.name}:`);
        dependencyColumns.forEach(col => {
          console.log(`  • ${col.title} (connects to other board items)`);
        });
      }
    }
    
    console.log(`\n💡 To replicate this setup programmatically:`);
    console.log(`1. Update your .env file with the correct board IDs`);
    console.log(`2. Use the connection setup scripts to create dependency columns`);
    console.log(`3. Use mirror columns to display INCI names from connected ingredients`);
    
  } catch (error) {
    console.error('❌ Discovery failed:', error.message);
    if (error.response?.data) {
      console.error('API Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

if (require.main === module) {
  discoverBoards();
}

module.exports = { discoverBoards };