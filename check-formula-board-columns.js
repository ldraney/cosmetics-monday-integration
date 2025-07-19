const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function checkFormulaBoardColumns() {
  console.log('📋 Checking Formulas Board Column Structure...\n');
  
  try {
    const formulasBoardId = process.env.FORMULAS_BOARD_ID;
    
    const boardQuery = `
      query {
        boards(ids: [${formulasBoardId}]) {
          name
          columns {
            id
            title
            type
            description
          }
        }
      }
    `;
    
    const response = await monday.api(boardQuery);
    const board = response.data?.boards?.[0];
    
    if (!board) {
      console.error('❌ Formulas board not found');
      return;
    }
    
    console.log(`📊 Board: ${board.name}`);
    console.log(`🏗️  Columns: ${board.columns.length}\n`);
    
    console.log('📋 Column Structure:');
    board.columns.forEach((col, i) => {
      console.log(`${i + 1}. ${col.title} (${col.type}) [${col.id}]`);
      if (col.description) {
        console.log(`   └ Description: ${col.description}`);
      }
    });
    
    // Check for dependency columns
    const dependencyColumns = board.columns.filter(col => col.type === 'dependency');
    console.log(`\n🔗 Dependency Columns Found: ${dependencyColumns.length}`);
    
    if (dependencyColumns.length > 0) {
      console.log('✅ Dependency columns available:');
      dependencyColumns.forEach(col => {
        console.log(`  • ${col.title} (${col.id})`);
      });
    } else {
      console.log('❌ No dependency columns found');
      console.log('💡 Need to add a dependency column to connect formulas to ingredients');
    }
    
    // Check for other relevant columns
    const relevantColumns = board.columns.filter(col => 
      col.title.toLowerCase().includes('ingredient') ||
      col.title.toLowerCase().includes('connect') ||
      col.title.toLowerCase().includes('link')
    );
    
    if (relevantColumns.length > 0) {
      console.log('\n🎯 Other relevant columns:');
      relevantColumns.forEach(col => {
        console.log(`  • ${col.title} (${col.type}) [${col.id}]`);
      });
    }
    
    return board.columns;
    
  } catch (error) {
    console.error('❌ Error checking board columns:', error.message);
    return null;
  }
}

// Run if called directly
if (require.main === module) {
  checkFormulaBoardColumns();
}

module.exports = { checkFormulaBoardColumns };