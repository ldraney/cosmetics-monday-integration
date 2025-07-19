const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function showManualInstructions() {
  console.log('🎯 MANUAL CONNECTION SETUP REQUIRED\n');
  
  try {
    const formulasBoardId = process.env.FORMULAS_BOARD_ID;
    const ingredientsBoardId = process.env.INGREDIENTS_BOARD_ID;
    
    console.log('📋 BOARD INFORMATION:');
    console.log(`Formulas Board ID: ${formulasBoardId}`);
    console.log(`Ingredients Board ID: ${ingredientsBoardId}`);
    
    // Get board URLs
    console.log('\\n🔗 BOARD URLS:');
    console.log(`Formulas Board: https://monday.com/boards/${formulasBoardId}`);
    console.log(`Ingredients Board: https://monday.com/boards/${ingredientsBoardId}`);
    
    console.log('\\n🔧 MANUAL SETUP STEPS:');
    console.log('1. Go to the Formulas Board: https://monday.com/boards/' + formulasBoardId);
    console.log('2. Find the "Connected Ingredients" column');
    console.log('3. Click the column header settings (three dots)');
    console.log('4. Select "Edit column"');
    console.log('5. In the settings, change "Connect to board" to point to:');
    console.log(`   "🧪 Ingredients Master Database" (ID: ${ingredientsBoardId})`);
    console.log('6. Save the settings');
    
    console.log('\\n✅ AFTER MANUAL SETUP:');
    console.log('Run this command to create the actual connections:');
    console.log('node create-actual-connections.js');
    
    // Let's also check if we can create a text-based approach
    console.log('\\n🔧 ALTERNATIVE APPROACH:');
    console.log('If dependency connections are too complex, we can:');
    console.log('1. Create a text column with ingredient names and percentages');
    console.log('2. Make it clickable/searchable for practical use');
    
    // Show what a manual connection would look like
    console.log('\\n📊 SAMPLE CONNECTION DATA:');
    console.log('Formula: Marine-Love Refining Mask');
    console.log('Ingredients needed:');
    
    const ingredientIds = [
      { name: 'White Kaolin Clay', id: '9625734160', percentage: '70%' },
      { name: 'Bentonite Clay', id: '9625734285', percentage: '20%' },
      { name: 'Arrowroot Powder', id: '9625835083', percentage: '5%' },
      { name: 'MSM', id: '9625733728', percentage: '3%' },
      { name: 'Blue Spirulina powder', id: '9625733870', percentage: '1%' }
    ];
    
    ingredientIds.forEach(ing => {
      console.log(`  • ${ing.name} (${ing.percentage}) [Monday ID: ${ing.id}]`);
    });
    
    console.log('\\n🎯 WHAT WE NEED TO ACHIEVE:');
    console.log('Visual connection in Monday.com where:');
    console.log('- Clicking a formula shows its ingredients');
    console.log('- Clicking an ingredient shows which formulas use it');
    console.log('- Cost calculations work automatically');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

// Run if called directly
if (require.main === module) {
  showManualInstructions();
}

module.exports = { showManualInstructions };