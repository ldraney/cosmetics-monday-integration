const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function getFortifyingFinal() {
  try {
    const testBoardId = '9625728737';
    
    console.log('🔍 Getting Fortifying Cream Cleanser with correct column query...');
    
    // Get board columns definition first
    const boardQuery = `
      query {
        boards(ids: [${testBoardId}]) {
          name
          columns {
            id
            title
            type
          }
        }
      }
    `;
    
    const boardResponse = await monday.api(boardQuery);
    const board = boardResponse.data?.boards?.[0];
    const columns = board?.columns || [];
    
    console.log(`📋 Board: ${board?.name}`);
    console.log(`📊 Found ${columns.length} columns`);
    
    // Find the board_relation column
    const boardRelationColumn = columns.find(col => col.type === 'board_relation');
    if (boardRelationColumn) {
      console.log(`\n🔗 Board Relation Column: ${boardRelationColumn.title} (ID: ${boardRelationColumn.id})`);
    }
    
    // Now get the Fortifying item with its column values
    const itemQuery = `
      query {
        boards(ids: [${testBoardId}]) {
          items_page(limit: 100) {
            items {
              id
              name
              column_values {
                id
                type
                text
                value
              }
            }
          }
        }
      }
    `;
    
    const itemResponse = await monday.api(itemQuery);
    const items = itemResponse.data?.boards?.[0]?.items_page?.items || [];
    
    // Find Fortifying Cream Cleanser
    const fortifyingItem = items.find(item => 
      item.name && item.name.toLowerCase().includes('fortifying')
    );
    
    if (!fortifyingItem) {
      console.log('❌ Fortifying Cream Cleanser not found');
      return;
    }
    
    console.log(`\n✅ FOUND: ${fortifyingItem.name} (ID: ${fortifyingItem.id})`);
    console.log(`📊 Has ${fortifyingItem.column_values?.length || 0} column values`);
    
    // Match column values with column definitions
    console.log('\n📊 COLUMN DETAILS:');
    fortifyingItem.column_values.forEach(colVal => {
      const colDef = columns.find(col => col.id === colVal.id);
      const title = colDef?.title || 'Unknown';
      
      console.log(`\n• ${title} (${colVal.type}) [ID: ${colVal.id}]`);
      console.log(`  Text: ${colVal.text || 'null'}`);
      console.log(`  Value: ${colVal.value || 'null'}`);
      
      // Special attention to board_relation
      if (colVal.type === 'board_relation') {
        console.log(`  🔗 THIS IS THE BOARD RELATION COLUMN!`);
        if (colVal.value && colVal.value !== 'null' && colVal.value !== '{}') {
          console.log(`  ✅ HAS CONNECTION VALUE!`);
          try {
            const parsed = JSON.parse(colVal.value);
            console.log(`  Parsed: ${JSON.stringify(parsed, null, 4)}`);
          } catch (e) {
            console.log(`  Raw value: ${colVal.value}`);
          }
        } else {
          console.log(`  ❌ No connection value - column is empty`);
        }
      }
    });
    
    return {
      item: fortifyingItem,
      boardRelationColumn,
      allColumns: columns
    };
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  }
}

getFortifyingFinal();