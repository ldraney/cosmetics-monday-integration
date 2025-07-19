const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function connectTestFormulas() {
  console.log('🔗 Connecting formulas to ingredients on TEST board...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Using your TEST board configuration
    const testBoardId = '9625728737'; // Cosmetics Formulas - TEST
    const ingredientsBoardId = '9625733140'; // Ingredients Master Database
    const connectionColumnId = 'board_relation_mkt08v2f'; // Your existing connection column
    
    console.log('📋 BOARD CONFIGURATION:');
    console.log(`TEST Board: ${testBoardId}`);
    console.log(`Ingredients Board: ${ingredientsBoardId}`);
    console.log(`Connection Column: ${connectionColumnId}`);
    
    // Get all formula-ingredient relationships from database
    console.log('\n📊 Loading formula-ingredient relationships...');
    
    const relationshipsQuery = `
      SELECT 
        f.id as formula_id,
        f.name as formula_name,
        f.version,
        f.status,
        array_agg(
          json_build_object(
            'ingredient_id', i.id,
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
      LIMIT 5
    `;
    
    const result = await pool.query(relationshipsQuery);
    console.log(`✅ Found ${result.rows.length} formulas to process`);
    
    // Get Monday items
    console.log('\n📋 Getting Monday items...');
    
    // Get formulas from TEST board
    const formulasQuery = `
      query {
        boards(ids: [${testBoardId}]) {
          items_page(limit: 100) {
            items {
              id
              name
            }
          }
        }
      }
    `;
    
    const formulasResponse = await monday.api(formulasQuery);
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
    
    console.log(`📊 Monday items: ${mondayFormulas.length} formulas, ${mondayIngredients.length} ingredients`);
    
    // Create ingredient lookup map
    const ingredientMap = new Map();
    mondayIngredients.forEach(ing => {
      ingredientMap.set(ing.name.toLowerCase().trim(), ing.id);
    });
    
    // Process each formula
    let totalConnections = 0;
    let successfulFormulas = 0;
    
    for (const formula of result.rows) {
      console.log(`\n🔧 Processing: ${formula.formula_name}`);
      console.log(`   Database ID: ${formula.formula_id}`);
      console.log(`   Ingredients: ${formula.ingredients.length}`);
      
      // Find matching Monday formula
      const mondayFormula = mondayFormulas.find(mf => {
        const mfClean = mf.name.toLowerCase().trim();
        const fClean = formula.formula_name.toLowerCase().trim();
        return mfClean.includes(fClean) || fClean.includes(mfClean);
      });
      
      if (!mondayFormula) {
        console.log(`   ⚠️  No Monday item found for: ${formula.formula_name}`);
        
        // Show available formulas for debugging
        console.log(`   Available Monday formulas:`);
        mondayFormulas.slice(0, 3).forEach(mf => {
          console.log(`     - "${mf.name}"`);
        });
        continue;
      }
      
      console.log(`   ✅ Found Monday formula: "${mondayFormula.name}" (${mondayFormula.id})`);
      
      // Find Monday IDs for ingredients
      const ingredientIds = [];
      let foundCount = 0;
      
      for (const ing of formula.ingredients) {
        const cleanName = ing.ingredient_name.toLowerCase().trim();
        const mondayIngId = ingredientMap.get(cleanName);
        
        if (mondayIngId) {
          ingredientIds.push(mondayIngId);
          foundCount++;
          console.log(`     ✅ ${ing.ingredient_name} (${ing.percentage}%) → ${mondayIngId}`);
        } else {
          console.log(`     ⚠️  ${ing.ingredient_name} not found`);
        }
      }
      
      if (ingredientIds.length === 0) {
        console.log(`   ❌ No ingredients found on Monday`);
        continue;
      }
      
      console.log(`   📊 Connecting ${foundCount}/${formula.ingredients.length} ingredients`);
      
      // Create the connection using board_relation format
      try {
        const connectionValue = {
          "item_ids": ingredientIds
        };
        
        const updateMutation = `
          mutation {
            change_column_value (
              board_id: ${testBoardId},
              item_id: ${mondayFormula.id},
              column_id: "${connectionColumnId}",
              value: "${JSON.stringify(JSON.stringify(connectionValue))}"
            ) {
              id
            }
          }
        `;
        
        await monday.api(updateMutation);
        totalConnections += ingredientIds.length;
        successfulFormulas++;
        
        console.log(`   ✅ Successfully connected ${ingredientIds.length} ingredients!`);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`   ❌ Connection failed: ${error.message}`);
        
        // Try alternative format
        console.log(`   🔄 Trying alternative format...`);
        try {
          const altUpdateMutation = `
            mutation {
              change_column_value (
                board_id: ${testBoardId},
                item_id: ${mondayFormula.id},
                column_id: "${connectionColumnId}",
                value: "{\\"item_ids\\": [${ingredientIds.join(',')}]}"
              ) {
                id
              }
            }
          `;
          
          await monday.api(altUpdateMutation);
          totalConnections += ingredientIds.length;
          successfulFormulas++;
          console.log(`   ✅ Alternative format worked!`);
          
        } catch (altError) {
          console.error(`   ❌ Both formats failed: ${altError.message}`);
        }
      }
    }
    
    console.log('\n🎉 CONNECTION COMPLETE!');
    console.log(`✅ Successfully connected ${successfulFormulas} formulas`);
    console.log(`🔗 Created ${totalConnections} total ingredient connections`);
    
    console.log('\n🎯 WHAT YOU NOW HAVE:');
    console.log('• Click any formula to see its connected ingredients');
    console.log('• INCI names should appear automatically via mirror column');
    console.log('• Click ingredients to see which formulas use them');
    console.log('• Full traceability through the ingredient chain');
    
    console.log('\n📋 NEXT STEPS:');
    console.log('1. Check your TEST board to see the connections');
    console.log('2. Verify INCI names appear in the mirror column');
    console.log('3. Test clicking through the relationships');
    console.log('4. If it works, we can replicate on main boards!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  connectTestFormulas();
}

module.exports = { connectTestFormulas };