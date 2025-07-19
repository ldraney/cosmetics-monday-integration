const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function createWorkingConnections() {
  console.log('🔗 Creating working formula-ingredient connections...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const formulasBoardId = process.env.FORMULAS_BOARD_ID;
    const ingredientsBoardId = process.env.INGREDIENTS_BOARD_ID;
    
    // Option 1: Try creating a NEW connect_boards column
    console.log('🔧 Attempting to create connect_boards column...');
    
    try {
      const createConnectColumnMutation = `
        mutation {
          create_column (
            board_id: ${formulasBoardId},
            title: "Formula Ingredients",
            column_type: connect_boards
          ) {
            id
            title
            type
            settings_str
          }
        }
      `;
      
      const connectResponse = await monday.api(createConnectColumnMutation);
      const connectColumn = connectResponse.data?.create_column;
      
      if (connectColumn) {
        console.log('✅ Created connect_boards column!');
        console.log(`  ID: ${connectColumn.id}`);
        console.log(`  Settings: ${connectColumn.settings_str}`);
        
        // Now we need to manually connect the boards in Monday UI
        console.log('\\n⚠️  MANUAL STEP REQUIRED:');
        console.log('1. Go to Monday.com boards');
        console.log('2. Edit the "Formula Ingredients" column');
        console.log('3. Select "Ingredients Master Database" as the connected board');
        console.log('4. Save settings');
        console.log('5. Run this script again to populate connections');
        
        return connectColumn.id;
      }
      
    } catch (error) {
      console.log('❌ Cannot create connect_boards column:', error.message);
    }
    
    // Option 2: Create a detailed text column with ingredient breakdown
    console.log('\\n🔧 Creating detailed ingredient breakdown column...');
    
    try {
      const createTextColumnMutation = `
        mutation {
          create_column (
            board_id: ${formulasBoardId},
            title: "Ingredient Breakdown",
            column_type: long_text
          ) {
            id
            title
            type
          }
        }
      `;
      
      const textResponse = await monday.api(createTextColumnMutation);
      const textColumn = textResponse.data?.create_column;
      
      if (textColumn) {
        console.log('✅ Created ingredient breakdown column');
        console.log(`  ID: ${textColumn.id}`);
        
        // Now populate it with actual ingredient data
        console.log('\\n📊 Populating with ingredient data...');
        
        // Get one formula to test
        const formulaQuery = `
          SELECT 
            f.id as formula_id,
            f.name as formula_name,
            json_agg(
              json_build_object(
                'ingredient_name', i.name,
                'percentage', fi.percentage,
                'monday_id', 'TBD'
              ) ORDER BY fi.percentage DESC
            ) as ingredients
          FROM formulas f
          JOIN formula_ingredients fi ON f.id = fi.formula_id
          JOIN ingredients i ON fi.ingredient_id = i.id
          WHERE f.name = 'Marine-Love Refining Mask'
          GROUP BY f.id, f.name
          LIMIT 1
        `;
        
        const result = await pool.query(formulaQuery);
        if (result.rows.length > 0) {
          const formula = result.rows[0];
          
          // Get Monday formula item
          const mondayFormulaQuery = `
            query {
              boards(ids: [${formulasBoardId}]) {
                items_page(limit: 100) {
                  items {
                    id
                    name
                  }
                }
              }
            }
          `;
          
          const formulaResponse = await monday.api(mondayFormulaQuery);
          const mondayFormulas = formulaResponse.data?.boards?.[0]?.items_page?.items || [];
          
          const mondayFormula = mondayFormulas.find(mf => 
            mf.name.toLowerCase().includes(formula.formula_name.toLowerCase())
          );
          
          if (mondayFormula) {
            // Create detailed ingredient breakdown text
            let ingredientText = `FORMULA: ${formula.formula_name}\\n\\n`;
            ingredientText += `INGREDIENTS (${formula.ingredients.length} total):\\n`;
            ingredientText += `═══════════════════════════════\\n\\n`;
            
            formula.ingredients.forEach((ing, index) => {
              ingredientText += `${index + 1}. ${ing.ingredient_name}\\n`;
              ingredientText += `   Percentage: ${ing.percentage}%\\n`;
              ingredientText += `   Search Monday: "${ing.ingredient_name}"\\n`;
              ingredientText += `\\n`;
            });
            
            ingredientText += `\\nTotal Ingredients: ${formula.ingredients.length}\\n`;
            ingredientText += `Last Updated: ${new Date().toISOString()}\\n`;
            ingredientText += `\\nNOTE: Search ingredient names in Ingredients board for pricing`;
            
            // Update the Monday item
            const updateMutation = `
              mutation {
                change_column_value (
                  board_id: ${formulasBoardId},
                  item_id: ${mondayFormula.id},
                  column_id: "${textColumn.id}",
                  value: "${JSON.stringify(ingredientText).replace(/"/g, '\\"')}"
                ) {
                  id
                }
              }
            `;
            
            await monday.api(updateMutation);
            console.log('✅ Updated formula with ingredient breakdown');
            console.log(`📋 Formula: ${formula.formula_name}`);
            console.log(`🧪 Ingredients: ${formula.ingredients.length}`);
          }
        }
        
        return textColumn.id;
      }
      
    } catch (error) {
      console.log('❌ Cannot create text column:', error.message);
    }
    
    // Option 3: Use existing dependency column with proper format
    console.log('\\n🔧 Testing dependency column with different approach...');
    
    // First, let's see what boards this dependency column CAN connect to
    const boardsQuery = `
      query {
        boards(limit: 50) {
          id
          name
          description
        }
      }
    `;
    
    const boardsResponse = await monday.api(boardsQuery);
    const allBoards = boardsResponse.data?.boards || [];
    
    console.log('\\n📋 Available boards for connections:');
    allBoards.forEach(board => {
      console.log(`  • ${board.name} (ID: ${board.id})`);
    });
    
    // Try to find if there's any item on the formulas board we can connect to
    const formulaItemsQuery = `
      query {
        boards(ids: [${formulasBoardId}]) {
          items_page(limit: 10) {
            items {
              id
              name
            }
          }
        }
      }
    `;
    
    const formulaItemsResponse = await monday.api(formulaItemsQuery);
    const formulaItems = formulaItemsResponse.data?.boards?.[0]?.items_page?.items || [];
    
    if (formulaItems.length > 1) {
      console.log('\\n🔧 Testing dependency connection between formula items...');
      
      const item1 = formulaItems[0];
      const item2 = formulaItems[1];
      
      const testDepMutation = `
        mutation {
          change_column_value (
            board_id: ${formulasBoardId},
            item_id: ${item1.id},
            column_id: "dependency_mkt02nwy",
            value: "{\\"item_ids\\": [${item2.id}]}"
          ) {
            id
          }
        }
      `;
      
      try {
        await monday.api(testDepMutation);
        console.log(`✅ Successfully connected ${item1.name} → ${item2.name}`);
        
        // Verify
        const verifyQuery = `
          query {
            items(ids: [${item1.id}]) {
              column_values(ids: ["dependency_mkt02nwy"]) {
                text
                value
              }
            }
          }
        `;
        
        const verifyResponse = await monday.api(verifyQuery);
        const depValue = verifyResponse.data?.items?.[0]?.column_values?.[0];
        console.log(`📊 Dependency value: ${depValue?.value || 'empty'}`);
        
      } catch (error) {
        console.log('❌ Dependency test failed:', error.message);
      }
    }
    
    console.log('\\n🎯 SUMMARY:');
    console.log('- connect_boards columns cannot be created via API');
    console.log('- dependency columns only work within the same board');
    console.log('- text columns work and can provide detailed ingredient info');
    console.log('- Manual board connection setup is still required for true connections');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  createWorkingConnections();
}

module.exports = { createWorkingConnections };