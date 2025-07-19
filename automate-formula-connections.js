const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function automateFormulaConnections() {
  console.log('🚀 AUTOMATING FORMULA-INGREDIENT CONNECTIONS...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const testBoardId = '9625728737';
    const ingredientsBoardId = '9625733140';
    const connectionColumnId = 'board_relation_mkt08v2f';
    
    // Get formulas from database (start with just 3 for testing)
    console.log('📊 Getting formulas with ingredients from database...');
    
    const formulasQuery = `
      SELECT 
        f.id as formula_id,
        f.name as formula_name,
        f.version,
        f.status,
        json_agg(
          json_build_object(
            'ingredient_name', i.name,
            'percentage', fi.percentage,
            'inci_name', i.inci_name
          ) ORDER BY fi.percentage DESC
        ) as ingredients
      FROM formulas f
      JOIN formula_ingredients fi ON f.id = fi.formula_id
      JOIN ingredients i ON fi.ingredient_id = i.id
      WHERE f.status = 'approved'
      GROUP BY f.id, f.name, f.version, f.status
      ORDER BY f.name
      LIMIT 3
    `;
    
    const result = await pool.query(formulasQuery);
    console.log(`✅ Found ${result.rows.length} formulas to process\n`);
    
    // Get Monday items
    console.log('📋 Getting Monday data...');
    
    // Get formulas
    const mondayFormulasQuery = `
      query {
        boards(ids: [${testBoardId}]) {
          items_page(limit: 100) {
            items {
              id
              name
              column_values(ids: ["${connectionColumnId}"]) {
                ... on BoardRelationValue {
                  linked_item_ids
                  linked_items {
                    id
                    name
                  }
                }
              }
            }
          }
        }
      }
    `;
    
    const formulasResponse = await monday.api(mondayFormulasQuery);
    const mondayFormulas = formulasResponse.data?.boards?.[0]?.items_page?.items || [];
    
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
    
    console.log(`📊 Monday data: ${mondayFormulas.length} formulas, ${mondayIngredients.length} ingredients\n`);
    
    // Create ingredient lookup map
    const ingredientMap = new Map();
    mondayIngredients.forEach(ing => {
      ingredientMap.set(ing.name.toLowerCase().trim(), ing.id);
    });
    
    // Process each formula
    let successfulFormulas = 0;
    let totalConnections = 0;
    
    for (const formula of result.rows) {
      console.log(`🔧 Processing: ${formula.formula_name}`);
      console.log(`   Ingredients: ${formula.ingredients.length}`);
      
      // Find matching Monday formula
      const mondayFormula = mondayFormulas.find(mf => {
        const mfClean = mf.name.toLowerCase().trim();
        const fClean = formula.formula_name.toLowerCase().trim();
        return mfClean.includes(fClean) || fClean.includes(mfClean);
      });
      
      if (!mondayFormula) {
        console.log(`   ⚠️  No Monday item found for: ${formula.formula_name}`);
        continue;
      }
      
      console.log(`   ✅ Found Monday formula: "${mondayFormula.name}" (${mondayFormula.id})`);
      
      // Check if already connected
      const existingConnections = mondayFormula.column_values?.[0]?.linked_item_ids || [];
      if (existingConnections.length > 0) {
        console.log(`   📊 Already has ${existingConnections.length} connections - skipping`);
        continue;
      }
      
      // Find ingredient IDs
      const ingredientIds = [];
      let foundCount = 0;
      
      for (const ing of formula.ingredients) {
        const cleanName = ing.ingredient_name.toLowerCase().trim();
        const mondayIngId = ingredientMap.get(cleanName);
        
        if (mondayIngId) {
          ingredientIds.push(mondayIngId);
          foundCount++;
        }
      }
      
      console.log(`   📊 Found ${foundCount}/${formula.ingredients.length} ingredients on Monday`);
      
      if (ingredientIds.length === 0) {
        console.log(`   ❌ No ingredients found for connection`);
        continue;
      }
      
      // Create the connection
      try {
        const columnValues = {};
        columnValues[connectionColumnId] = {
          "item_ids": ingredientIds
        };
        
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
        
        const updateResponse = await monday.api(updateMutation);
        
        if (updateResponse.data?.change_multiple_column_values?.id) {
          successfulFormulas++;
          totalConnections += ingredientIds.length;
          console.log(`   ✅ Connected ${ingredientIds.length} ingredients!`);
        } else {
          console.log(`   ❌ Connection failed`);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`   ❌ Error connecting ${formula.formula_name}: ${error.message}`);
      }
      
      console.log(''); // Empty line between formulas
    }
    
    console.log('🎉 AUTOMATION COMPLETE!');
    console.log(`✅ Successfully connected ${successfulFormulas} formulas`);
    console.log(`🔗 Created ${totalConnections} total connections`);
    
    // Verify results
    console.log('\n🔍 Verifying all connections...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const verifyResponse = await monday.api(mondayFormulasQuery);
    const verifyFormulas = verifyResponse.data?.boards?.[0]?.items_page?.items || [];
    
    let connectedFormulas = 0;
    let connectedIngredients = 0;
    
    verifyFormulas.forEach(formula => {
      const connections = formula.column_values?.[0]?.linked_item_ids || [];
      if (connections.length > 0) {
        connectedFormulas++;
        connectedIngredients += connections.length;
      }
    });
    
    console.log(`📊 Verification: ${connectedFormulas} formulas with ${connectedIngredients} total ingredient connections`);
    
  } catch (error) {
    console.error('❌ Error in automation:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

automateFormulaConnections();