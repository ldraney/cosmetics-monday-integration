const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();

async function checkBoardStructure() {
  console.log('🔍 Checking Monday.com board structure...');
  
  if (!process.env.MONDAY_API_TOKEN) {
    console.error('❌ MONDAY_API_TOKEN environment variable required');
    return;
  }
  
  monday.setToken(process.env.MONDAY_API_TOKEN);
  
  try {
    // Check all configured boards
    const boardIds = [
      { id: process.env.FORMULAS_BOARD_ID, name: 'Formulas Board' },
      { id: process.env.INGREDIENTS_BOARD_ID, name: 'Ingredients Board' },
      { id: process.env.PRICING_BOARD_ID, name: 'Pricing Board' },
      { id: process.env.INCI_BOARD_ID, name: 'INCI Board' }
    ].filter(board => board.id);
    
    console.log(`📋 Checking ${boardIds.length} configured boards...\n`);
    
    for (const boardConfig of boardIds) {
      try {
        console.log(`🔍 Analyzing ${boardConfig.name} (ID: ${boardConfig.id})`);
        console.log('='.repeat(60));
        
        const boardQuery = `
          query {
            boards(ids: [${boardConfig.id}]) {
              id
              name
              description
              columns {
                id
                title
                type
                settings_str
              }
            }
          }
        `;
        
        const itemsQuery = `
          query {
            boards(ids: [${boardConfig.id}]) {
              items(limit: 3) {
                id
                name
                column_values {
                  id
                  title
                  text
                  value
                }
              }
            }
          }
        `;
        
        const response = await monday.api(boardQuery);
        const board = response.data.boards[0];
        
        if (!board) {
          console.log(`❌ Board ${boardConfig.id} not found or inaccessible\n`);
          continue;
        }
        
        console.log(`✅ Board: ${board.name}`);
        console.log(`📝 Description: ${board.description || 'No description'}`);
        
        console.log('\n🏛️ Columns:');
        board.columns.forEach((column, index) => {
          console.log(`  ${index + 1}. ${column.title} (${column.type}) [ID: ${column.id}]`);
          
          // Parse settings for more detail
          if (column.settings_str) {
            try {
              const settings = JSON.parse(column.settings_str);
              if (settings.labels && column.type === 'color') {
                console.log(`     Options: ${Object.values(settings.labels).join(', ')}`);
              } else if (settings.options && column.type === 'dropdown') {
                console.log(`     Options: ${settings.options.map(opt => opt.name).join(', ')}`);
              } else if (settings.boardIds && column.type === 'dependency') {
                console.log(`     Connected to boards: ${settings.boardIds.join(', ')}`);
              }
            } catch (e) {
              // Settings parsing failed, skip
            }
          }
        });
        
        // Check for ingredient/formula connection columns
        const connectionColumns = board.columns.filter(col => 
          col.title.toLowerCase().includes('ingredient') ||
          col.title.toLowerCase().includes('component') ||
          col.title.toLowerCase().includes('formula') ||
          col.title.toLowerCase().includes('connect') ||
          col.title.toLowerCase().includes('link') ||
          col.type === 'dependency' ||
          col.type === 'link'
        );
        
        if (connectionColumns.length > 0) {
          console.log('\n🔗 Connection/Relationship columns:');
          connectionColumns.forEach(col => {
            console.log(`    • ${col.title} (${col.type})`);
          });
        }
        
        // Get sample items in separate query
        try {
          const itemsResponse = await monday.api(itemsQuery);
          const items = itemsResponse.data.boards[0]?.items || [];
          
          if (items.length > 0) {
            console.log(`\n📊 Sample items (${items.length}):`);
            items.forEach((item, index) => {
              console.log(`  ${index + 1}. ${item.name}`);
              const relevantValues = item.column_values.filter(cv => cv.text && cv.text.trim());
              if (relevantValues.length > 0) {
                relevantValues.slice(0, 3).forEach(cv => {
                  console.log(`     ${cv.title}: ${cv.text}`);
                });
              }
            });
          } else {
            console.log('\n📊 No items found in this board');
          }
        } catch (itemsError) {
          console.log('\n📊 Could not fetch items for this board');
        }
        
        console.log('\n');
        
      } catch (boardError) {
        console.log(`❌ Error checking ${boardConfig.name}: ${boardError.message}\n`);
      }
    }
    
    // Analysis and recommendations
    console.log('🔍 ANALYSIS & RECOMMENDATIONS');
    console.log('='.repeat(60));
    
    // Check if ingredients board exists and has connection to formulas
    if (process.env.INGREDIENTS_BOARD_ID && process.env.FORMULAS_BOARD_ID) {
      console.log('✅ Both ingredients and formulas boards are configured');
      console.log('💡 Recommendation: Create dependency columns to connect them');
    } else {
      console.log('❌ Missing board configuration for complete integration');
    }
    
    console.log('\n📋 Next steps for ingredient integration:');
    console.log('1. Add "Ingredients" column (type: dependency) to formulas board');
    console.log('2. Connect to ingredients board via dependency relationship');
    console.log('3. Add percentage/quantity columns for ingredient amounts');
    console.log('4. Use subitems or mirror columns for detailed ingredient data');
    console.log('5. Create automation rules for data consistency');
    
  } catch (error) {
    console.error('❌ Error checking board structure:', error.message);
    if (error.response?.data) {
      console.error('API Response:', error.response.data);
    }
  }
}

if (require.main === module) {
  checkBoardStructure();
}

module.exports = { checkBoardStructure };