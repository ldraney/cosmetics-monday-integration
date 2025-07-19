const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function connectTestFormulasFixed() {
  console.log('🔗 Connecting formulas to ingredients (CORRECTED FORMAT)...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Using the exact configuration from your TEST board
    const testBoardId = '9625728737'; // Cosmetics Formulas - TEST
    const ingredientsBoardId = '9625733140'; // Ingredients Master Database
    const connectionColumnId = 'board_relation_mkt08v2f'; // Your exact column ID
    
    console.log('📋 BOARD CONFIGURATION:');
    console.log(`TEST Board: ${testBoardId}`);
    console.log(`Ingredients Board: ${ingredientsBoardId}`);
    console.log(`Connection Column: ${connectionColumnId}`);
    
    // Get one formula to test with
    console.log('\n📊 Loading ONE formula to test...');
    
    const testQuery = `
      SELECT 
        f.id as formula_id,
        f.name as formula_name,
        array_agg(
          json_build_object(
            'ingredient_name', i.name,
            'percentage', fi.percentage
          ) ORDER BY fi.percentage DESC
        ) as ingredients
      FROM formulas f
      JOIN formula_ingredients fi ON f.id = fi.formula_id
      JOIN ingredients i ON fi.ingredient_id = i.id
      WHERE f.name = 'Aloe Vera Gel'
      GROUP BY f.id, f.name
      LIMIT 1
    `;
    
    const result = await pool.query(testQuery);
    if (result.rows.length === 0) {
      console.log('❌ No test formula found');
      return;
    }
    
    const formula = result.rows[0];
    console.log(`✅ Testing with: ${formula.formula_name}`);
    console.log(`   Ingredients: ${formula.ingredients.length}`);
    
    // Get Monday items
    console.log('\n📋 Getting Monday items...');
    
    // Get the specific formula
    const formulasQuery = `
      query {
        boards(ids: [${testBoardId}]) {
          items_page(limit: 100) {
            items {
              id
              name
              column_values(ids: ["${connectionColumnId}"]) {
                id
                text
                value
              }
            }
          }
        }
      }
    `;
    
    const formulasResponse = await monday.api(formulasQuery);
    const mondayFormulas = formulasResponse.data?.boards?.[0]?.items_page?.items || [];
    
    const mondayFormula = mondayFormulas.find(mf => 
      mf.name.toLowerCase().includes('aloe')
    );
    
    if (!mondayFormula) {
      console.log('❌ Aloe Vera Gel formula not found on Monday');
      return;
    }
    
    console.log(`✅ Found Monday formula: "${mondayFormula.name}" (${mondayFormula.id})`);
    
    // Check current connection value
    const currentConnection = mondayFormula.column_values?.[0];
    console.log(`Current connection value: ${currentConnection?.value || 'empty'}`);
    
    // Get ingredients
    const ingredientsQuery = `
      query {
        boards(ids: [${ingredientsBoardId}]) {
          items_page(limit: 500) {
            items {
              id
              name
            }
          }
        }
      }
    `;
    
    const ingredientsResponse = await monday.api(ingredientsQuery);
    const mondayIngredients = ingredientsResponse.data?.boards?.[0]?.items_page?.items || [];
    
    console.log(`📊 Found ${mondayIngredients.length} ingredients on Monday`);
    
    // Find ingredient IDs
    const ingredientIds = [];
    for (const ing of formula.ingredients) {
      const mondayIng = mondayIngredients.find(mi => 
        mi.name.toLowerCase().trim() === ing.ingredient_name.toLowerCase().trim()
      );
      
      if (mondayIng) {
        ingredientIds.push(parseInt(mondayIng.id));
        console.log(`  ✅ ${ing.ingredient_name} → ${mondayIng.id}`);
      } else {
        console.log(`  ⚠️  ${ing.ingredient_name} not found`);
      }
    }
    
    if (ingredientIds.length === 0) {
      console.log('❌ No ingredients found for connection');
      return;
    }
    
    console.log(`\n🔧 Connecting ${ingredientIds.length} ingredients...`);
    
    // Create connection using the CORRECT format from documentation
    const columnValues = {};
    columnValues[connectionColumnId] = {
      "item_ids": ingredientIds
    };
    
    console.log('🔍 Connection format:');
    console.log(JSON.stringify(columnValues, null, 2));
    
    const updateMutation = `
      mutation {
        change_multiple_column_values(
          item_id: ${mondayFormula.id},
          board_id: ${testBoardId},
          column_values: "${JSON.stringify(JSON.stringify(columnValues)).slice(1, -1)}"
        ) {
          id
        }
      }
    `;
    
    console.log('\n🚀 Executing connection...');
    
    try {
      const updateResponse = await monday.api(updateMutation);
      
      if (updateResponse.data?.change_multiple_column_values?.id) {
        console.log('✅ Connection successful!');
        
        // Verify the connection
        console.log('\n🔍 Verifying connection...');
        
        const verifyQuery = `
          query {
            items(ids: [${mondayFormula.id}]) {
              column_values(ids: ["${connectionColumnId}"]) {
                id
                text
                value
              }
            }
          }
        `;
        
        const verifyResponse = await monday.api(verifyQuery);
        const verifyColumn = verifyResponse.data?.items?.[0]?.column_values?.[0];
        
        console.log(`Verification - Text: "${verifyColumn?.text || 'empty'}"`);
        console.log(`Verification - Value: "${verifyColumn?.value || 'empty'}"`);
        
        if (verifyColumn?.value && verifyColumn.value !== '{}') {
          console.log('\n🎉 SUCCESS! Connection is working!');
          console.log('✅ Check your TEST board to see the connected ingredients');
          console.log('✅ INCI names should now appear in the mirror column');
        } else {
          console.log('\n⚠️  Connection created but value is empty');
        }
        
      } else {
        console.log('❌ No response data from mutation');
        console.log(JSON.stringify(updateResponse, null, 2));
      }
      
    } catch (error) {
      console.error('❌ Connection failed:', error.message);
      
      if (error.message.includes('board')) {
        console.log('\n💡 This might be a board connection issue.');
        console.log('   Make sure the boards are already connected in Monday UI.');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  connectTestFormulasFixed();
}

module.exports = { connectTestFormulasFixed };