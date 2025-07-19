const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();

/**
 * Documents the complete TEST board setup configuration
 * This script captures all the details needed to replicate the setup
 */

async function documentTestSetup() {
  console.log('📝 DOCUMENTING TEST BOARD SETUP CONFIGURATION');
  console.log('==============================================\n');
  
  if (!process.env.MONDAY_API_TOKEN || process.env.MONDAY_API_TOKEN === 'your_monday_api_token_here') {
    console.error('❌ Please set your actual MONDAY_API_TOKEN in the .env file');
    return;
  }
  
  monday.setToken(process.env.MONDAY_API_TOKEN);
  
  try {
    // Board IDs from the TEST setup
    const testBoardId = '9625728737';
    const ingredientsBoardId = '9625733140';
    const inciBoardId = '9625740593';
    
    // Get complete configuration for all boards
    const configQuery = `
      query {
        boards(ids: [${testBoardId}, ${ingredientsBoardId}, ${inciBoardId}]) {
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
    
    const configResponse = await monday.api(configQuery);
    const boards = configResponse.data.boards;
    
    const testBoard = boards.find(b => b.id === testBoardId);
    const ingredientsBoard = boards.find(b => b.id === ingredientsBoardId);
    const inciBoard = boards.find(b => b.id === inciBoardId);
    
    console.log('🏗️ COMPLETE SETUP CONFIGURATION');
    console.log('='.repeat(50));
    
    // Generate configuration object
    const configuration = {
      setup_name: "Monday.com Cosmetics Integration - TEST Setup",
      created_date: new Date().toISOString(),
      description: "Complete configuration for Formulas → Ingredients → INCI integration with mirror columns",
      
      boards: {
        formulas: {
          id: testBoard.id,
          name: testBoard.name,
          description: testBoard.description,
          workspace: testBoard.workspace.name,
          workspace_id: testBoard.workspace.id
        },
        ingredients: {
          id: ingredientsBoard.id,
          name: ingredientsBoard.name,
          description: ingredientsBoard.description,
          workspace: ingredientsBoard.workspace.name,
          workspace_id: ingredientsBoard.workspace.id
        },
        inci: {
          id: inciBoard.id,
          name: inciBoard.name,
          description: inciBoard.description,
          workspace: inciBoard.workspace.name,
          workspace_id: inciBoard.workspace.id
        }
      },
      
      connections: [],
      mirror_columns: [],
      all_columns: {}
    };
    
    // Document all columns for each board
    [testBoard, ingredientsBoard, inciBoard].forEach(board => {
      const boardKey = board.id === testBoardId ? 'formulas' : 
                      board.id === ingredientsBoardId ? 'ingredients' : 'inci';
      
      configuration.all_columns[boardKey] = board.columns.map(col => ({
        id: col.id,
        title: col.title,
        type: col.type,
        settings: col.settings_str ? JSON.parse(col.settings_str) : null
      }));
    });
    
    // Document connections
    testBoard.columns.forEach(col => {
      if (col.type === 'board_relation') {
        try {
          const settings = JSON.parse(col.settings_str);
          configuration.connections.push({
            source_board: testBoard.id,
            source_board_name: testBoard.name,
            column_id: col.id,
            column_title: col.title,
            target_boards: settings.boardIds,
            target_board_names: settings.boardIds.map(id => {
              const targetBoard = boards.find(b => b.id === id);
              return targetBoard ? targetBoard.name : `Unknown (${id})`;
            })
          });
        } catch (e) {
          // Settings parsing failed
        }
      }
    });
    
    ingredientsBoard.columns.forEach(col => {
      if (col.type === 'board_relation') {
        try {
          const settings = JSON.parse(col.settings_str);
          configuration.connections.push({
            source_board: ingredientsBoard.id,
            source_board_name: ingredientsBoard.name,
            column_id: col.id,
            column_title: col.title,
            target_boards: settings.boardIds,
            target_board_names: settings.boardIds.map(id => {
              const targetBoard = boards.find(b => b.id === id);
              return targetBoard ? targetBoard.name : `Unknown (${id})`;
            })
          });
        } catch (e) {
          // Settings parsing failed
        }
      }
    });
    
    // Document mirror columns
    testBoard.columns.forEach(col => {
      if (col.type === 'mirror') {
        try {
          const settings = JSON.parse(col.settings_str);
          const sourceBoard = boards.find(b => b.id === settings.mirrorBoardId);
          const sourceColumn = sourceBoard?.columns.find(c => c.id === settings.mirrorColumnId);
          const dependencyColumn = testBoard.columns.find(c => c.id === settings.dependencyColumnId);
          
          configuration.mirror_columns.push({
            board: testBoard.id,
            board_name: testBoard.name,
            column_id: col.id,
            column_title: col.title,
            mirror_source_board: settings.mirrorBoardId,
            mirror_source_board_name: sourceBoard?.name || 'Unknown',
            mirror_source_column: settings.mirrorColumnId,
            mirror_source_column_title: sourceColumn?.title || 'Unknown',
            dependency_column: settings.dependencyColumnId,
            dependency_column_title: dependencyColumn?.title || 'Unknown'
          });
        } catch (e) {
          // Settings parsing failed
        }
      }
    });
    
    // Display the configuration
    console.log(JSON.stringify(configuration, null, 2));
    
    // Generate setup instructions
    console.log('\\n\\n🔧 REPLICATION INSTRUCTIONS');
    console.log('='.repeat(40));
    console.log('To replicate this setup in a new environment:\\n');
    
    console.log('1. Create Boards:');
    configuration.connections.forEach((conn, index) => {
      if (index === 0) {
        console.log(`   • Create "${conn.source_board_name}" board`);
      }
      conn.target_board_names.forEach(targetName => {
        console.log(`   • Create "${targetName}" board`);
      });
    });
    
    console.log('\\n2. Create Connection Columns:');
    configuration.connections.forEach(conn => {
      console.log(`   • On "${conn.source_board_name}": Add "${conn.column_title}" (board_relation)`);
      console.log(`     → Connect to: ${conn.target_board_names.join(', ')}`);
    });
    
    console.log('\\n3. Create Mirror Columns:');
    configuration.mirror_columns.forEach(mirror => {
      console.log(`   • On "${mirror.board_name}": Add "${mirror.column_title}" (mirror)`);
      console.log(`     → Mirror from: "${mirror.mirror_source_column_title}" on "${mirror.mirror_source_board_name}"`);
      console.log(`     → Via connection: "${mirror.dependency_column_title}"`);
    });
    
    console.log('\\n4. Data Flow:');
    console.log('   • Formulas connect to Ingredients (many-to-many)');
    console.log('   • Ingredients connect to INCI (many-to-one typically)');
    console.log('   • INCI names automatically appear in Formulas via mirror');
    
    // Generate code snippet for automation
    console.log('\\n\\n💻 AUTOMATION CODE SNIPPET');
    console.log('='.repeat(30));
    console.log('```javascript');
    console.log('// Board IDs');
    console.log(`const FORMULAS_BOARD_ID = "${testBoard.id}";`);
    console.log(`const INGREDIENTS_BOARD_ID = "${ingredientsBoard.id}";`);
    console.log(`const INCI_BOARD_ID = "${inciBoardId}";`);
    console.log('');
    console.log('// Column IDs');
    configuration.connections.forEach(conn => {
      const varName = `${conn.source_board_name.toUpperCase().replace(/[^A-Z]/g, '_')}_TO_${conn.target_board_names[0].toUpperCase().replace(/[^A-Z]/g, '_')}_COLUMN`;
      console.log(`const ${varName} = "${conn.column_id}";`);
    });
    configuration.mirror_columns.forEach(mirror => {
      const varName = `${mirror.column_title.toUpperCase().replace(/[^A-Z]/g, '_')}_MIRROR_COLUMN`;
      console.log(`const ${varName} = "${mirror.column_id}";`);
    });
    console.log('```');
    
    console.log('\\n✅ Documentation complete! Save this output for future reference.');
    
    return configuration;
    
  } catch (error) {
    console.error('❌ Documentation failed:', error.message);
    if (error.response?.data) {
      console.error('API Response:', JSON.stringify(error.response.data, null, 2));
    }
    return null;
  }
}

if (require.main === module) {
  documentTestSetup();
}

module.exports = { documentTestSetup };