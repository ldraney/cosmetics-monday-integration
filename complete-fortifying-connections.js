const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function completeFortifyingConnections() {
  console.log('🔗 Completing Fortifying Cream Cleanser connections...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const testBoardId = '9625728737';
    const ingredientsBoardId = '9625733140';
    const connectionColumnId = 'board_relation_mkt08v2f';
    const fortifyingItemId = '9625729143';
    
    // Get Fortifying Cream Cleanser ingredients from database
    console.log('📊 Getting Fortifying Cream Cleanser ingredients from database...');
    
    const formulaQuery = `
      SELECT 
        f.name as formula_name,
        i.name as ingredient_name,
        fi.percentage,
        i.inci_name
      FROM formulas f
      JOIN formula_ingredients fi ON f.id = fi.formula_id
      JOIN ingredients i ON fi.ingredient_id = i.id
      WHERE f.name ILIKE '%fortifying%cream%cleanser%'
      ORDER BY fi.percentage DESC
    `;
    
    const result = await pool.query(formulaQuery);
    console.log(`✅ Found ${result.rows.length} ingredients for Fortifying Cream Cleanser`);
    
    result.rows.forEach(row => {
      console.log(`  • ${row.ingredient_name} (${row.percentage}%)`);
    });
    
    // Get Monday ingredients
    console.log('\n📋 Getting Monday ingredients...');
    
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
    
    // Create ingredient lookup map
    const ingredientMap = new Map();
    mondayIngredients.forEach(ing => {
      ingredientMap.set(ing.name.toLowerCase().trim(), ing.id);
    });
    
    // Find all ingredient IDs
    const ingredientIds = [];
    let foundCount = 0;
    
    console.log('\n🔍 Matching ingredients...');
    for (const row of result.rows) {
      const cleanName = row.ingredient_name.toLowerCase().trim();
      const mondayIngId = ingredientMap.get(cleanName);
      
      if (mondayIngId) {
        ingredientIds.push(mondayIngId);
        foundCount++;
        console.log(`  ✅ ${row.ingredient_name} (${row.percentage}%) → ${mondayIngId}`);
      } else {
        console.log(`  ⚠️  ${row.ingredient_name} not found on Monday`);
      }
    }
    
    console.log(`\n📊 Found ${foundCount}/${result.rows.length} ingredients on Monday`);
    
    if (ingredientIds.length === 0) {
      console.log('❌ No ingredients found for connection');
      return;
    }
    
    // Create the connection using correct format
    console.log(`\n🔧 Connecting ${ingredientIds.length} ingredients...`);
    
    const columnValues = {};
    columnValues[connectionColumnId] = {
      "item_ids": ingredientIds
    };
    
    console.log('Connection payload:');
    console.log(JSON.stringify(columnValues, null, 2));
    
    const updateMutation = `
      mutation {
        change_multiple_column_values(
          item_id: ${fortifyingItemId},
          board_id: ${testBoardId},
          column_values: "${JSON.stringify(JSON.stringify(columnValues)).slice(1, -1)}"
        ) {
          id
        }
      }
    `;
    
    console.log('\n🚀 Executing connection...');
    
    const updateResponse = await monday.api(updateMutation);
    
    if (updateResponse.data?.change_multiple_column_values?.id) {
      console.log('✅ Mutation successful!');
      
      // Wait for Monday to process
      console.log('⏳ Waiting 3 seconds for Monday to process...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Verify using correct format
      console.log('\n🔍 Verifying connections...');
      
      const verifyQuery = `
        query {
          items(ids: [${fortifyingItemId}]) {
            name
            column_values(ids: ["${connectionColumnId}"]) {
              ... on BoardRelationValue {
                linked_item_ids
                linked_items {
                  id
                  name
                }
                display_value
              }
            }
          }
        }
      `;
      
      const verifyResponse = await monday.api(verifyQuery);
      const item = verifyResponse.data?.items?.[0];
      const connection = item?.column_values?.[0];
      
      if (connection?.linked_item_ids && connection.linked_item_ids.length > 0) {
        console.log(`\n🎉 SUCCESS! Connected ${connection.linked_item_ids.length} ingredients:`);
        connection.linked_items?.forEach(linkedItem => {
          console.log(`  • ${linkedItem.name} (ID: ${linkedItem.id})`);
        });
        console.log(`\nDisplay value: "${connection.display_value}"`);
      } else {
        console.log('\n⚠️  No connections found in verification');
      }
      
    } else {
      console.log('❌ Mutation failed');
      console.log(JSON.stringify(updateResponse, null, 2));
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

completeFortifyingConnections();