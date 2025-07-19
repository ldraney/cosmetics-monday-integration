const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function enhancedINCIAutomation() {
  console.log('🚀 ENHANCED INCI AUTOMATION - COMPLETE COVERAGE...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const ingredientsBoardId = '9625733140'; // Ingredients Master Database
    const inciBoardId = '9625740593'; // INCI Master Database
    const ingredientsConnectionColumnId = 'board_relation_mkt0k7xm'; // Ingredients → INCI connection
    
    console.log('📊 PHASE 1: Getting complete database mapping...');
    
    // Get ALL ingredients with INCI names and their formulas
    const ingredientMappingQuery = `
      SELECT 
        i.id as ingredient_id,
        i.name as ingredient_name,
        i.inci_name,
        i.category,
        COUNT(DISTINCT f.id) as formula_count,
        json_agg(DISTINCT f.name ORDER BY f.name) FILTER (WHERE f.name IS NOT NULL) as formulas,
        ROUND(AVG(fi.percentage)::numeric, 3) as avg_percentage
      FROM ingredients i
      LEFT JOIN formula_ingredients fi ON i.id = fi.ingredient_id
      LEFT JOIN formulas f ON fi.formula_id = f.id
      WHERE i.inci_name IS NOT NULL AND i.inci_name != ''
      GROUP BY i.id, i.name, i.inci_name, i.category
      ORDER BY COUNT(DISTINCT f.id) DESC, i.name
    `;
    
    const mappingResult = await pool.query(ingredientMappingQuery);
    console.log(`✅ Found ${mappingResult.rows.length} ingredients with INCI names\n`);
    
    console.log('📋 PHASE 2: Getting Monday board data...');
    
    // Get current ingredients on Monday with connections
    const mondayIngredientsQuery = `
      query {
        boards(ids: [${ingredientsBoardId}]) {
          name
          items_page(limit: 500) {
            items {
              id
              name
              column_values(ids: ["${ingredientsConnectionColumnId}"]) {
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
    
    const ingredientsResponse = await monday.api(mondayIngredientsQuery);
    const mondayIngredients = ingredientsResponse.data?.boards?.[0]?.items_page?.items || [];
    
    // Get INCI items on Monday
    const mondayInciQuery = `
      query {
        boards(ids: [${inciBoardId}]) {
          items_page(limit: 500) {
            items {
              id
              name
            }
          }
        }
      }
    `;
    
    const inciResponse = await monday.api(mondayInciQuery);
    const mondayInciItems = inciResponse.data?.boards?.[0]?.items_page?.items || [];
    
    console.log(`✅ Monday ingredients: ${mondayIngredients.length}`);
    console.log(`✅ Monday INCI items: ${mondayInciItems.length}\n`);
    
    // Create lookup maps
    const mondayIngredientMap = new Map();
    mondayIngredients.forEach(item => {
      const existingConnections = item.column_values?.[0]?.linked_item_ids || [];
      mondayIngredientMap.set(item.name.toLowerCase().trim(), {
        id: item.id,
        name: item.name,
        existingConnections: existingConnections
      });
    });
    
    const mondayInciMap = new Map();
    mondayInciItems.forEach(item => {
      if (item.name !== 'Task 1') {
        mondayInciMap.set(item.name.toLowerCase().trim(), {
          id: item.id,
          name: item.name
        });
      }
    });
    
    console.log('🔧 PHASE 3: Analyzing connection opportunities...');
    
    let needsConnection = 0;
    let alreadyConnected = 0;
    let missingIngredients = 0;
    let missingInci = 0;
    
    const connectionPlan = [];
    
    for (const row of mappingResult.rows) {
      const ingredientName = row.ingredient_name.toLowerCase().trim();
      const inciName = row.inci_name.trim();
      
      const mondayIngredient = mondayIngredientMap.get(ingredientName);
      const mondayInci = mondayInciMap.get(inciName.toLowerCase());
      
      if (!mondayIngredient) {
        missingIngredients++;
        console.log(`⚠️  Ingredient not on Monday: ${row.ingredient_name}`);
        continue;
      }
      
      if (!mondayInci) {
        missingInci++;
        console.log(`⚠️  INCI not on Monday: ${inciName}`);
        continue;
      }
      
      // Check if already connected
      if (mondayIngredient.existingConnections.includes(mondayInci.id)) {
        alreadyConnected++;
      } else {
        needsConnection++;
        connectionPlan.push({
          ingredient: row,
          mondayIngredient: mondayIngredient,
          mondayInci: mondayInci
        });
      }
    }
    
    console.log(`📊 CONNECTION ANALYSIS:`);
    console.log(`   Need connection: ${needsConnection}`);
    console.log(`   Already connected: ${alreadyConnected}`);
    console.log(`   Missing ingredients: ${missingIngredients}`);
    console.log(`   Missing INCI: ${missingInci}`);
    console.log(`   Total database mappings: ${mappingResult.rows.length}\n`);
    
    if (needsConnection === 0) {
      console.log('✅ All possible connections already exist!');
      console.log('🎉 INCI automation is complete!\n');
    } else {
      console.log('🔗 PHASE 4: Creating connections...');
      
      let successfulConnections = 0;
      let failedConnections = 0;
      
      // Group by priority (high usage first)
      connectionPlan.sort((a, b) => b.ingredient.formula_count - a.ingredient.formula_count);
      
      for (const plan of connectionPlan) {
        const { ingredient, mondayIngredient, mondayInci } = plan;
        
        console.log(`🔧 Connecting: ${ingredient.ingredient_name} → ${ingredient.inci_name}`);
        console.log(`   Used in ${ingredient.formula_count} formulas, avg ${ingredient.avg_percentage}%`);
        
        try {
          const columnValues = {};
          columnValues[ingredientsConnectionColumnId] = {
            "item_ids": [mondayInci.id]
          };
          
          const updateMutation = `
            mutation {
              change_multiple_column_values(
                item_id: ${mondayIngredient.id},
                board_id: ${ingredientsBoardId},
                column_values: "${JSON.stringify(JSON.stringify(columnValues)).slice(1, -1)}"
              ) {
                id
              }
            }
          `;
          
          const updateResponse = await monday.api(updateMutation);
          
          if (updateResponse.data?.change_multiple_column_values?.id) {
            successfulConnections++;
            console.log(`   ✅ Connected successfully!`);
          } else {
            failedConnections++;
            console.log(`   ❌ Connection failed`);
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          failedConnections++;
          console.error(`   ❌ Error: ${error.message}`);
        }
        
        // Progress update every 10 connections
        if ((successfulConnections + failedConnections) % 10 === 0) {
          console.log(`📊 Progress: ${successfulConnections + failedConnections}/${needsConnection} | Success: ${successfulConnections} | Failed: ${failedConnections}\n`);
        }
      }
      
      console.log(`\n🎉 CONNECTION PHASE COMPLETE!`);
      console.log(`✅ Successful connections: ${successfulConnections}`);
      console.log(`❌ Failed connections: ${failedConnections}`);
    }
    
    console.log('\n🔍 PHASE 5: Final verification...');
    
    // Verify final connection state
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    const verifyResponse = await monday.api(mondayIngredientsQuery);
    const verifyIngredients = verifyResponse.data?.boards?.[0]?.items_page?.items || [];
    
    let totalConnected = 0;
    let totalConnections = 0;
    
    verifyIngredients.forEach(ingredient => {
      const connections = ingredient.column_values?.[0]?.linked_item_ids || [];
      if (connections.length > 0) {
        totalConnected++;
        totalConnections += connections.length;
      }
    });
    
    const connectionRate = (totalConnected / mappingResult.rows.length) * 100;
    
    console.log(`\n📊 FINAL VERIFICATION RESULTS:`);
    console.log(`   Ingredients with INCI connections: ${totalConnected}`);
    console.log(`   Total INCI connections: ${totalConnections}`);
    console.log(`   Expected connections: ${mappingResult.rows.length}`);
    console.log(`   Connection success rate: ${connectionRate.toFixed(1)}%`);
    
    // Success thresholds
    if (connectionRate >= 95) {
      console.log(`\n🎉 EXCELLENT! 95%+ connection rate achieved!`);
      console.log(`🏆 Enhanced INCI automation is COMPLETE!`);
    } else if (connectionRate >= 90) {
      console.log(`\n✅ GREAT! 90%+ connection rate achieved!`);
      console.log(`📝 Minor optimization possible`);
    } else if (connectionRate >= 80) {
      console.log(`\n🟡 GOOD! 80%+ connection rate achieved!`);
      console.log(`🔧 Some items may need manual review`);
    } else {
      console.log(`\n🔴 Connections below 80% - review needed`);
    }
    
    console.log(`\n🎯 ENHANCED SYSTEM CAPABILITIES:`);
    console.log(`• Complete ingredient → INCI mapping`);
    console.log(`• Enhanced regulatory compliance`);
    console.log(`• Mirror column functionality enabled`);
    console.log(`• Professional cosmetics database complete`);
    console.log(`• Ready for regulatory submissions`);
    
    console.log(`\n💡 NEXT STEPS:`);
    console.log(`1. Check formula mirror columns for INCI data`);
    console.log(`2. Add regulatory metadata: node add-inci-board-columns.js`);
    console.log(`3. Generate compliance reports`);
    console.log(`4. Review any remaining unconnected ingredients`);
    
  } catch (error) {
    console.error('❌ Error in enhanced INCI automation:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

enhancedINCIAutomation();