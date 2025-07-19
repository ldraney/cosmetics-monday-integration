const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();

async function addPricingColumn() {
  console.log('💰 Adding Pricing Column to Ingredients Board...');
  
  try {
    if (!process.env.MONDAY_API_TOKEN) {
      console.error('❌ MONDAY_API_TOKEN environment variable required');
      return;
    }
    
    monday.setToken(process.env.MONDAY_API_TOKEN);
    
    const ingredientsBoardId = process.env.INGREDIENTS_BOARD_ID;
    console.log(`📋 Ingredients Board ID: ${ingredientsBoardId}`);
    
    // Add pricing column to Ingredients board
    console.log('\n💰 Adding "Price per KG ($)" column...');
    
    const pricingColumnMutation = `
      mutation {
        create_column (
          board_id: ${ingredientsBoardId},
          title: "Price per KG",
          column_type: numbers
        ) {
          id
          title
          type
        }
      }
    `;
    
    try {
      const pricingResponse = await monday.api(pricingColumnMutation);
      console.log(`✅ Created pricing column successfully`);
      console.log(`📊 Column details:`, pricingResponse.data);
    } catch (error) {
      console.log(`⚠️  Error creating pricing column:`, error.message);
      if (error.response?.data) {
        console.log('API Response:', error.response.data);
      }
    }
    
    // Add total cost column to Formulas board  
    console.log('\n💰 Adding "Total Cost per KG" column to Formulas board...');
    
    const formulasBoardId = process.env.FORMULAS_BOARD_ID;
    
    const costColumnMutation = `
      mutation {
        create_column (
          board_id: ${formulasBoardId},
          title: "Total Cost per KG",
          column_type: numbers
        ) {
          id
          title
          type
        }
      }
    `;
    
    try {
      const costResponse = await monday.api(costColumnMutation);
      console.log(`✅ Created cost calculation column successfully`);
    } catch (error) {
      console.log(`⚠️  Error creating cost column:`, error.message);
    }
    
    console.log(`\n🎉 PRICING COLUMNS SETUP COMPLETE!`);
    console.log(`\n📋 Your boards now have:`);
    console.log(`  🧪 Ingredients: Price per KG column`);
    console.log(`  🧪 Formulas: Total Cost per KG column`);
    
    console.log(`\n🔗 Board links:`);
    console.log(`  🧪 Ingredients: https://monday.com/boards/${ingredientsBoardId}`);
    console.log(`  🧪 Formulas: https://monday.com/boards/${formulasBoardId}`);
    
    console.log(`\n🚀 Ready for:`);
    console.log(`  1. Loading your actual pricing data`);
    console.log(`  2. Creating ingredient-formula relationships`);
    console.log(`  3. Automatic cost calculations`);
    
  } catch (error) {
    console.error('❌ Error adding pricing columns:', error.message);
  }
}

if (require.main === module) {
  addPricingColumn();
}

module.exports = { addPricingColumn };