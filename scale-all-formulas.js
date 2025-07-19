const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function scaleAllFormulas() {
  console.log('🚀 SCALING TO ALL 78 FORMULAS...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const testBoardId = '9625728737';
    const ingredientsBoardId = '9625733140';
    const connectionColumnId = 'board_relation_mkt08v2f';
    
    // Get ALL approved formulas from database
    console.log('📊 Getting ALL approved formulas from database...');
    
    const formulasQuery = `
      SELECT 
        f.id as formula_id,
        f.name as formula_name,
        f.version,
        f.status,
        COUNT(fi.id) as ingredient_count,
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
      HAVING COUNT(fi.id) > 0
      ORDER BY f.name
    `;
    
    const result = await pool.query(formulasQuery);
    console.log(`✅ Found ${result.rows.length} approved formulas with ingredients\n`);
    
    // Get Monday data
    console.log('📋 Getting Monday data...');
    
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
                  display_value
                }
              }
            }
          }
        }
      }
    `;
    
    const formulasResponse = await monday.api(mondayFormulasQuery);
    const mondayFormulas = formulasResponse.data?.boards?.[0]?.items_page?.items || [];
    
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
    
    // Show statistics first
    let alreadyConnected = 0;
    mondayFormulas.forEach(formula => {
      const connections = formula.column_values?.[0]?.linked_item_ids || [];
      if (connections.length > 0) {
        alreadyConnected++;
      }
    });
    
    console.log(`📊 CURRENT STATE:`);
    console.log(`   Formulas already connected: ${alreadyConnected}`);
    console.log(`   Formulas to process: ${result.rows.length}`);
    console.log(`   Target: Connect all ${result.rows.length} formulas\n`);
    
    // Process each formula
    let successfulFormulas = 0;
    let skippedFormulas = 0;
    let totalNewConnections = 0;
    let processedCount = 0;
    
    for (const formula of result.rows) {
      processedCount++;
      
      console.log(`\n[${processedCount}/${result.rows.length}] 🔧 ${formula.formula_name}`);
      console.log(`   DB ingredients: ${formula.ingredient_count}`);
      
      // Find matching Monday formula
      const mondayFormula = mondayFormulas.find(mf => {
        const mfClean = mf.name.toLowerCase().trim();
        const fClean = formula.formula_name.toLowerCase().trim();
        return mfClean.includes(fClean) || fClean.includes(mfClean);
      });
      
      if (!mondayFormula) {
        console.log(`   ⚠️  No Monday item found`);
        skippedFormulas++;
        continue;
      }
      
      console.log(`   ✅ Monday: "${mondayFormula.name}" (${mondayFormula.id})`);
      
      // Check if already connected
      const existingConnections = mondayFormula.column_values?.[0]?.linked_item_ids || [];
      if (existingConnections.length > 0) {
        console.log(`   📊 Already connected (${existingConnections.length} ingredients)`);
        skippedFormulas++;
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
      
      console.log(`   📊 Matched: ${foundCount}/${formula.ingredient_count} ingredients`);
      
      if (ingredientIds.length === 0) {
        console.log(`   ❌ No ingredients found for connection`);
        skippedFormulas++;
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
          totalNewConnections += ingredientIds.length;
          console.log(`   ✅ Connected ${ingredientIds.length} ingredients!`);
        } else {
          console.log(`   ❌ Connection failed`);
          skippedFormulas++;
        }
        
        // Rate limiting - be respectful to Monday API
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        skippedFormulas++;
      }
      
      // Progress indicator every 10 formulas
      if (processedCount % 10 === 0) {
        console.log(`\n📊 Progress: ${processedCount}/${result.rows.length} formulas processed`);
        console.log(`   ✅ Success: ${successfulFormulas} | ⚠️  Skipped: ${skippedFormulas}`);
      }
    }
    
    console.log('\n🎉 SCALING COMPLETE!');
    console.log(`✅ Successfully connected: ${successfulFormulas} new formulas`);
    console.log(`⚠️  Skipped: ${skippedFormulas} formulas`);
    console.log(`🔗 New connections created: ${totalNewConnections}`);
    
    // Final verification
    console.log('\n🔍 Final verification...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const finalVerifyResponse = await monday.api(mondayFormulasQuery);
    const finalFormulas = finalVerifyResponse.data?.boards?.[0]?.items_page?.items || [];
    
    let totalConnectedFormulas = 0;
    let totalConnectedIngredients = 0;
    
    finalFormulas.forEach(formula => {
      const connections = formula.column_values?.[0]?.linked_item_ids || [];
      if (connections.length > 0) {
        totalConnectedFormulas++;
        totalConnectedIngredients += connections.length;
      }
    });
    
    console.log(`\n📊 FINAL RESULTS:`);
    console.log(`   Total formulas with connections: ${totalConnectedFormulas}`);
    console.log(`   Total ingredient connections: ${totalConnectedIngredients}`);
    console.log(`   Coverage: ${((totalConnectedFormulas / result.rows.length) * 100).toFixed(1)}%`);
    
    if (totalConnectedFormulas >= result.rows.length * 0.9) {
      console.log('\n🎉 EXCELLENT! 90%+ coverage achieved!');
    } else if (totalConnectedFormulas >= result.rows.length * 0.7) {
      console.log('\n✅ GOOD! 70%+ coverage achieved!');
    } else {
      console.log('\n⚠️  More work needed - check for missing formulas');
    }
    
  } catch (error) {
    console.error('❌ Error in scaling:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

scaleAllFormulas();