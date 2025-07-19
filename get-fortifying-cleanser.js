const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function getFortifyingCreamCleanser() {
  try {
    const testBoardId = '9625728737';
    
    console.log('🔍 Getting all items from TEST board to find Fortifying Cream Cleanser...');
    
    const query = `
      query {
        boards(ids: [${testBoardId}]) {
          name
          items_page(limit: 100) {
            items {
              id
              name
            }
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
    
    const items = board.items_page?.items || [];
    console.log(`📊 Total items on board: ${items.length}`);
    
    // Search for Fortifying Cream Cleanser
    console.log('\n🔍 Searching for Fortifying Cream Cleanser...');
    
    const fortifyingItems = items.filter(item => 
      item.name.toLowerCase().includes('fortifying')
    );
    
    if (fortifyingItems.length > 0) {
      console.log('\n✅ FOUND FORTIFYING ITEMS:');
      fortifyingItems.forEach(item => {
        console.log(`  • ${item.name} (ID: ${item.id})`);
      });
    } else {
      console.log('\n❌ No items with "fortifying" found');
    }
    
    // Also search for "cream cleanser"
    const cleanserItems = items.filter(item => 
      item.name.toLowerCase().includes('cream') && 
      item.name.toLowerCase().includes('cleanser')
    );
    
    if (cleanserItems.length > 0) {
      console.log('\n🧴 CREAM CLEANSER ITEMS:');
      cleanserItems.forEach(item => {
        console.log(`  • ${item.name} (ID: ${item.id})`);
      });
    }
    
    // Show first 10 items for reference
    console.log('\n📋 First 10 items on board:');
    items.slice(0, 10).forEach((item, index) => {
      console.log(`  ${index + 1}. ${item.name} (ID: ${item.id})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Full error:', error);
  }
}

getFortifyingCreamCleanser();