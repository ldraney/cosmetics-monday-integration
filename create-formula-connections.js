const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function createFormulaConnections() {
  console.log('🔗 Creating formula-ingredient connections...\n');
  console.log('Prerequisites:');
  console.log('✓ Manual setup of "Connected Ingredients" column completed');
  console.log('✓ Column configured to connect to Ingredients board\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const formulasBoardId = process.env.FORMULAS_BOARD_ID;
    const ingredientsBoardId = process.env.INGREDIENTS_BOARD_ID;
    
    // Get the connect_boards column ID
    console.log('🔍 Finding connect_boards column...');
    
    const columnsQuery = `
      query {
        boards(ids: [${formulasBoardId}]) {
          columns {
            id
            title
            type
            settings_str
          }
        }
      }
    `;
    
    const columnsResponse = await monday.api(columnsQuery);
    const columns = columnsResponse.data?.boards?.[0]?.columns || [];
    
    const connectColumn = columns.find(col => 
      col.type === 'board-relation' && 
      (col.title.includes('Ingredient') || col.settings_str?.includes(ingredientsBoardId))
    );
    
    if (!connectColumn) {
      console.log('❌ No connect_boards column found!');
      console.log('\nPlease complete manual setup:');
      console.log('1. Go to Formulas board');
      console.log('2. Add "Connect boards" column');
      console.log('3. Configure it to connect to Ingredients board');
      console.log('4. Run this script again\n');
      return;
    }
    
    console.log(`✅ Found column: ${connectColumn.title} (${connectColumn.id})`);
    
    // Get all formula-ingredient relationships
    console.log('\n📊 Loading formula-ingredient relationships...');
    
    const relationshipsQuery = `
      SELECT 
        f.id as formula_id,
        f.name as formula_name,
        f.version,
        array_agg(
          json_build_object(
            'ingredient_id', i.id,
            'ingredient_name', i.name,
            'percentage', fi.percentage
          ) ORDER BY fi.percentage DESC
        ) as ingredients
      FROM formulas f
      JOIN formula_ingredients fi ON f.id = fi.formula_id
      JOIN ingredients i ON fi.ingredient_id = i.id
      WHERE f.status = 'approved'
      GROUP BY f.id, f.name, f.version
      ORDER BY f.name
    `;
    
    const result = await pool.query(relationshipsQuery);
    console.log(`✅ Found ${result.rows.length} formulas with ingredients`);
    
    // Get Monday items
    console.log('\n📋 Getting Monday items...');
    
    // Get formulas
    const formulasQuery = `
      query {
        boards(ids: [${formulasBoardId}]) {
          items_page(limit: 500) {
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
      ingredientMap.set(ing.name.toLowerCase(), ing.id);
    });
    
    // Process each formula
    let totalConnections = 0;
    let successfulFormulas = 0;
    
    for (const formula of result.rows) {
      const mondayFormula = mondayFormulas.find(mf => 
        mf.name.toLowerCase().includes(formula.formula_name.toLowerCase()) ||
        formula.formula_name.toLowerCase().includes(mf.name.toLowerCase())
      );
      
      if (!mondayFormula) {
        console.log(`\n⚠️  No Monday item found for: ${formula.formula_name}`);
        continue;
      }
      
      console.log(`\n🔧 Processing: ${formula.formula_name} (${formula.ingredients.length} ingredients)`);
      
      // Find Monday IDs for all ingredients
      const ingredientIds = [];
      let foundCount = 0;
      
      for (const ing of formula.ingredients) {
        const mondayIngId = ingredientMap.get(ing.ingredient_name.toLowerCase());
        if (mondayIngId) {
          ingredientIds.push(mondayIngId);
          foundCount++;
        } else {
          console.log(`  ⚠️  Ingredient not found: ${ing.ingredient_name}`);
        }
      }
      
      if (ingredientIds.length === 0) {
        console.log(`  ❌ No ingredients found on Monday`);
        continue;
      }
      
      console.log(`  ✅ Found ${foundCount}/${formula.ingredients.length} ingredients`);
      
      // Create the connection
      try {
        const updateMutation = `
          mutation {
            change_column_value (
              board_id: ${formulasBoardId},
              item_id: ${mondayFormula.id},
              column_id: "${connectColumn.id}",
              value: "{\\"item_ids\\": [${ingredientIds.join(',')}]}"
            ) {
              id
            }
          }
        `;
        
        await monday.api(updateMutation);
        totalConnections += ingredientIds.length;
        successfulFormulas++;
        
        console.log(`  ✅ Connected ${ingredientIds.length} ingredients`);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`  ❌ Failed to create connections: ${error.message}`);
      }
    }
    
    console.log('\n🎉 COMPLETE!');
    console.log(`✅ Successfully connected ${successfulFormulas} formulas`);
    console.log(`🔗 Created ${totalConnections} total connections`);
    
    console.log('\n🎯 WHAT YOU NOW HAVE:');
    console.log('• Click any formula to see its ingredients');
    console.log('• Click any ingredient to see which formulas use it');
    console.log('• Automatic cost calculations based on percentages');
    console.log('• Full traceability and visual relationships');
    console.log('• Two-way navigation between boards');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  createFormulaConnections();
}

module.exports = { createFormulaConnections };