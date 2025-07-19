const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();

async function analyzeTestBoardSetup() {
  console.log('🔬 ANALYZING TEST BOARD SETUP IN DETAIL');
  console.log('=====================================\n');
  
  if (!process.env.MONDAY_API_TOKEN || process.env.MONDAY_API_TOKEN === 'your_monday_api_token_here') {
    console.error('❌ Please set your actual MONDAY_API_TOKEN in the .env file');
    return;
  }
  
  monday.setToken(process.env.MONDAY_API_TOKEN);
  
  try {
    // Board IDs from discovery
    const testBoardId = '9625728737';
    const ingredientsBoardId = '9625733140';
    const inciBoardId = '9625740593';
    
    console.log('📋 ANALYZING BOARD RELATIONSHIPS...\n');
    
    // Get detailed column information for all three boards
    const boardsQuery = `
      query {
        boards(ids: [${testBoardId}, ${ingredientsBoardId}, ${inciBoardId}]) {
          id
          name
          columns {
            id
            title
            type
            settings_str
          }
        }
      }
    `;
    
    const boardsResponse = await monday.api(boardsQuery);
    const boards = boardsResponse.data.boards;
    
    const testBoard = boards.find(b => b.id === testBoardId);
    const ingredientsBoard = boards.find(b => b.id === ingredientsBoardId);
    const inciBoard = boards.find(b => b.id === inciBoardId);
    
    // Analyze TEST board connections
    console.log(`🧪 TEST BOARD: ${testBoard.name}`);
    console.log('=' .repeat(50));
    
    const connectionColumn = testBoard.columns.find(col => col.type === 'board_relation');
    const mirrorColumn = testBoard.columns.find(col => col.type === 'mirror');
    
    if (connectionColumn) {
      console.log(`🔗 Connection Column: "${connectionColumn.title}"`);
      console.log(`   ID: ${connectionColumn.id}`);
      console.log(`   Type: ${connectionColumn.type}`);
      
      if (connectionColumn.settings_str) {
        try {
          const settings = JSON.parse(connectionColumn.settings_str);
          console.log(`   Connected to boards: ${settings.boardIds?.join(', ') || 'Not specified'}`);
        } catch (e) {
          console.log(`   Settings: ${connectionColumn.settings_str}`);
        }
      }
    }
    
    if (mirrorColumn) {
      console.log(`\\n🪞 Mirror Column: "${mirrorColumn.title}"`);
      console.log(`   ID: ${mirrorColumn.id}`);
      console.log(`   Type: ${mirrorColumn.type}`);
      
      if (mirrorColumn.settings_str) {
        try {
          const settings = JSON.parse(mirrorColumn.settings_str);
          console.log(`   Mirror source board: ${settings.mirrorBoardId || 'Not specified'}`);
          console.log(`   Mirror source column: ${settings.mirrorColumnId || 'Not specified'}`);
          console.log(`   Via connection column: ${settings.dependencyColumnId || 'Not specified'}`);
        } catch (e) {
          console.log(`   Settings: ${mirrorColumn.settings_str}`);
        }
      }
    }
    
    // Analyze Ingredients Master Database
    console.log(`\\n🧪 INGREDIENTS MASTER DATABASE: ${ingredientsBoard.name}`);
    console.log('=' .repeat(60));
    
    ingredientsBoard.columns.forEach(col => {
      if (col.type === 'board_relation' || col.type === 'mirror' || col.title.toLowerCase().includes('inci')) {
        console.log(`   • ${col.title} (${col.type}) [ID: ${col.id}]`);
        
        if (col.settings_str) {
          try {
            const settings = JSON.parse(col.settings_str);
            if (settings.boardIds) {
              console.log(`     → Connected to boards: ${settings.boardIds.join(', ')}`);
            }
            if (settings.mirrorBoardId) {
              console.log(`     → Mirrors from board: ${settings.mirrorBoardId}`);
            }
          } catch (e) {
            // Settings parsing failed
          }
        }
      }
    });
    
    // Analyze INCI Master Database  
    console.log(`\\n🧬 INCI MASTER DATABASE: ${inciBoard.name}`);
    console.log('=' .repeat(50));
    
    inciBoard.columns.forEach(col => {
      if (col.type === 'board_relation' || col.type === 'mirror' || col.title.toLowerCase().includes('inci')) {
        console.log(`   • ${col.title} (${col.type}) [ID: ${col.id}]`);
      }
    });
    
    // Get sample data to understand the connection flow
    console.log(`\\n📊 SAMPLE DATA ANALYSIS`);
    console.log('=' .repeat(30));
    
    try {
      const sampleQuery = `
        query {
          boards(ids: [${testBoardId}]) {
            items(limit: 3) {
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
      
      const sampleResponse = await monday.api(sampleQuery);
      const items = sampleResponse.data.boards[0]?.items || [];
      
      if (items.length > 0) {
        console.log(`\\nSample items from TEST board:`);
        items.forEach((item, index) => {
          console.log(`\\n${index + 1}. ${item.name}`);
          
          // Show connection values
          const connectionValue = item.column_values.find(cv => cv.type === 'board_relation');
          if (connectionValue && connectionValue.text) {
            console.log(`   🔗 Connected ingredients: ${connectionValue.text}`);
          }
          
          // Show mirror values
          const mirrorValue = item.column_values.find(cv => cv.type === 'mirror');
          if (mirrorValue && mirrorValue.text) {
            console.log(`   🪞 INCI Names (mirrored): ${mirrorValue.text}`);
          }
          
          // Show raw values for debugging
          if (connectionValue && connectionValue.value && connectionValue.value !== '{}') {
            try {
              const parsed = JSON.parse(connectionValue.value);
              if (parsed.linkedPulseIds && parsed.linkedPulseIds.length > 0) {
                console.log(`   📌 Linked ingredient IDs: ${parsed.linkedPulseIds.join(', ')}`);
              }
            } catch (e) {
              console.log(`   📌 Connection value: ${connectionValue.value}`);
            }
          }
        });
      } else {
        console.log('No items found in TEST board');
      }
    } catch (error) {
      console.log(`❌ Could not fetch sample data: ${error.message}`);
    }
    
    // Configuration summary for replication
    console.log(`\\n🔧 REPLICATION CONFIGURATION`);
    console.log('=' .repeat(40));
    console.log('To replicate this setup programmatically:');
    console.log('');
    console.log('1. Board Structure:');
    console.log(`   • Formulas Board ID: ${testBoardId}`);
    console.log(`   • Ingredients Board ID: ${ingredientsBoardId}`);
    console.log(`   • INCI Board ID: ${inciBoardId}`);
    console.log('');
    console.log('2. Required Columns:');
    if (connectionColumn) {
      console.log(`   • Connection: "${connectionColumn.title}" (${connectionColumn.id})`);
    }
    if (mirrorColumn) {
      console.log(`   • Mirror: "${mirrorColumn.title}" (${mirrorColumn.id})`);
    }
    console.log('');
    console.log('3. Connection Flow:');
    console.log('   Formulas → Ingredients (via dependency column)');
    console.log('   Ingredients → INCI (via dependency column)');
    console.log('   Formulas see INCI names (via mirror column)');
    
  } catch (error) {
    console.error('❌ Analysis failed:', error.message);
    if (error.response?.data) {
      console.error('API Response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

if (require.main === module) {
  analyzeTestBoardSetup();
}

module.exports = { analyzeTestBoardSetup };