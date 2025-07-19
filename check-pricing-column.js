const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function checkPricingColumn() {
  console.log('🔍 CHECKING PRICING COLUMN STRUCTURE...\n');
  
  try {
    const ingredientsBoardId = '9625733140'; // Ingredients Master Database
    
    // Get board structure and see all columns
    const boardQuery = `
      query {
        boards(ids: [${ingredientsBoardId}]) {
          name
          columns {
            id
            title
            type
          }
          items_page(limit: 10) {
            items {
              id
              name
              column_values {
                id
                title
                type
                text
                value
              }
            }
          }
        }
      }
    `;
    
    const response = await monday.api(boardQuery);
    const board = response.data?.boards?.[0];
    
    if (!board) {
      console.log('❌ Board not found');
      return;
    }
    
    console.log(`📋 Board: ${board.name}\n`);
    
    console.log('📊 ALL COLUMNS:');
    console.log('===============');
    board.columns.forEach(col => {
      console.log(`• ${col.title} (${col.type}) [ID: ${col.id}]`);
    });
    
    // Look for pricing-related columns
    const pricingColumns = board.columns.filter(col => 
      col.title.toLowerCase().includes('price') || 
      col.title.toLowerCase().includes('cost') ||
      col.type === 'numeric'
    );
    
    console.log('\n💰 PRICING-RELATED COLUMNS:');
    console.log('===========================');
    if (pricingColumns.length > 0) {
      pricingColumns.forEach(col => {
        console.log(`• ${col.title} (${col.type}) [ID: ${col.id}]`);
      });
    } else {
      console.log('No pricing columns found');
    }
    
    // Show sample data from the first few items
    console.log('\n📋 SAMPLE ITEM DATA:');
    console.log('====================');
    
    if (board.items_page?.items?.length > 0) {
      const sampleItem = board.items_page.items[0];
      console.log(`Sample item: ${sampleItem.name}\n`);
      
      sampleItem.column_values.forEach(cv => {
        if (cv.text && cv.text.trim() !== '') {
          console.log(`• ${cv.title || cv.id}: ${cv.text} (${cv.type})`);
        }
      });
      
      // Look specifically for numeric columns that might contain pricing
      const numericColumns = sampleItem.column_values.filter(cv => 
        cv.type === 'numeric' && cv.text && cv.text.trim() !== ''
      );
      
      if (numericColumns.length > 0) {
        console.log('\n💰 NUMERIC COLUMNS WITH DATA:');
        numericColumns.forEach(cv => {
          console.log(`• ${cv.title || cv.id}: ${cv.text} [Column ID: ${cv.id}]`);
        });
      }
    }
    
  } catch (error) {
    console.error('❌ Error checking pricing column:', error.message);
  }
}

checkPricingColumn();