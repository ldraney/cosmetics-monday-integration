const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function finishRemainingFormulas() {
  console.log('🚀 FINISHING THE REMAINING FORMULAS...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const testBoardId = '9625728737';
    const ingredientsBoardId = '9625733140';
    const connectionColumnId = 'board_relation_mkt08v2f';
    
    // Get ALL approved formulas from database
    console.log('📊 Getting ALL formulas from database...');
    
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
            'percentage', fi.percentage
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
    console.log(`✅ Found ${result.rows.length} total formulas in database\n`);
    
    // Get Monday data with current connections
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
    
    // Count current connections
    let alreadyConnected = 0;
    let totalCurrentConnections = 0;
    const connectedFormulas = new Set();
    
    mondayFormulas.forEach(formula => {
      const connections = formula.column_values?.[0]?.linked_item_ids || [];
      if (connections.length > 0) {
        alreadyConnected++;
        totalCurrentConnections += connections.length;
        connectedFormulas.add(formula.name.toLowerCase().trim());
      }
    });
    
    console.log(`📊 CURRENT STATUS:`);
    console.log(`   Already connected: ${alreadyConnected} formulas`);
    console.log(`   Total connections: ${totalCurrentConnections}`);
    console.log(`   Remaining to process: ${result.rows.length - alreadyConnected}\n`);
    
    // Process only formulas that don't have connections yet
    let successfulFormulas = 0;
    let skippedFormulas = 0;
    let totalNewConnections = 0;
    let processedCount = 0;
    
    for (const formula of result.rows) {
      processedCount++;
      
      // Find matching Monday formula
      const mondayFormula = mondayFormulas.find(mf => {
        const mfClean = mf.name.toLowerCase().trim();
        const fClean = formula.formula_name.toLowerCase().trim();
        return mfClean.includes(fClean) || fClean.includes(mfClean);
      });
      
      if (!mondayFormula) {
        console.log(`[${processedCount}] ⚠️  ${formula.formula_name} - No Monday item found`);
        skippedFormulas++;
        continue;
      }
      
      // Check if already connected
      const existingConnections = mondayFormula.column_values?.[0]?.linked_item_ids || [];
      if (existingConnections.length > 0) {
        console.log(`[${processedCount}] ✅ ${formula.formula_name} - Already connected (${existingConnections.length})`);
        skippedFormulas++;
        continue;
      }
      
      console.log(`[${processedCount}] 🔧 ${formula.formula_name}`);
      console.log(`   Monday: "${mondayFormula.name}" (${mondayFormula.id})`);
      console.log(`   DB ingredients: ${formula.ingredient_count}`);
      
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
      
      console.log(`   Matched: ${foundCount}/${formula.ingredient_count} ingredients`);
      
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
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        skippedFormulas++;
      }
      
      // Progress update every 5 formulas
      if (processedCount % 5 === 0) {
        console.log(`\n📊 Progress: ${processedCount}/${result.rows.length} | New: ${successfulFormulas} | Skipped: ${skippedFormulas}\n`);
      }
    }
    
    console.log('\n🎉 COMPLETION PHASE DONE!');
    console.log(`✅ Newly connected: ${successfulFormulas} formulas`);
    console.log(`⚠️  Skipped: ${skippedFormulas} formulas`);
    console.log(`🔗 New connections created: ${totalNewConnections}`);
    
    // Final verification
    console.log('\n🔍 FINAL VERIFICATION...');
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
    
    console.log(`\n🎯 FINAL RESULTS:`);
    console.log(`   Total formulas with connections: ${totalConnectedFormulas}`);
    console.log(`   Total ingredient connections: ${totalConnectedIngredients}`);
    console.log(`   Database formulas: ${result.rows.length}`);
    console.log(`   Coverage: ${((totalConnectedFormulas / result.rows.length) * 100).toFixed(1)}%`);
    
    if (totalConnectedFormulas >= result.rows.length * 0.95) {
      console.log('\n🎉 EXCELLENT! 95%+ coverage achieved - JOB COMPLETE!');
    } else if (totalConnectedFormulas >= result.rows.length * 0.85) {
      console.log('\n✅ GREAT! 85%+ coverage achieved!');
    } else {
      console.log('\n📝 Good progress - some formulas may need manual review');
    }
    
    console.log('\n🚀 WHAT YOU NOW HAVE:');
    console.log('• Visual connections between formulas and ingredients');
    console.log('• Click-through navigation in Monday.com');
    console.log('• Complete ingredient traceability');
    console.log('• Automated cost calculation foundation');
    console.log('• Professional formula management system');
    
  } catch (error) {
    console.error('❌ Error in completion:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

finishRemainingFormulas();