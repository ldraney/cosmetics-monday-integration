const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function checkMissingData() {
  console.log('🔍 INVESTIGATING MISSING DATA AND CONNECTIONS\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // 1. Check database vs Monday discrepancies
    console.log('📊 DATABASE VS MONDAY COMPARISON:');
    
    // Get database counts
    const dbIngredientsResult = await pool.query('SELECT COUNT(*) FROM ingredients');
    const dbFormulasResult = await pool.query('SELECT COUNT(*) FROM formulas');
    const dbRelationshipsResult = await pool.query('SELECT COUNT(*) FROM formula_ingredients');
    
    console.log(`Database ingredients: ${dbIngredientsResult.rows[0].count}`);
    console.log(`Database formulas: ${dbFormulasResult.rows[0].count}`);
    console.log(`Database relationships: ${dbRelationshipsResult.rows[0].count}`);
    
    // Get Monday counts
    const ingredientsBoardId = process.env.INGREDIENTS_BOARD_ID;
    const formulasBoardId = process.env.FORMULAS_BOARD_ID;
    
    const mondayIngredientsQuery = `
      query {
        boards(ids: [${ingredientsBoardId}]) {
          items_count
          items_page(limit: 500) {
            items {
              id
              name
            }
          }
        }
      }
    `;
    
    const mondayFormulasQuery = `
      query {
        boards(ids: [${formulasBoardId}]) {
          items_count
          items_page(limit: 100) {
            items {
              id
              name
              column_values(ids: ["dependency_mkt02nwy"]) {
                id
                text
                value
              }
            }
          }
        }
      }
    `;
    
    const [ingredientsResponse, formulasResponse] = await Promise.all([
      monday.api(mondayIngredientsQuery),
      monday.api(mondayFormulasQuery)
    ]);
    
    const mondayIngredients = ingredientsResponse.data?.boards?.[0]?.items_page?.items || [];
    const mondayFormulas = formulasResponse.data?.boards?.[0]?.items_page?.items || [];
    
    console.log(`Monday ingredients: ${mondayIngredients.length}`);
    console.log(`Monday formulas: ${mondayFormulas.length}`);
    
    console.log('\n❌ GAPS IDENTIFIED:');
    console.log(`Missing ingredients: ${dbIngredientsResult.rows[0].count - mondayIngredients.length}`);
    console.log(`Missing formulas: ${dbFormulasResult.rows[0].count - mondayFormulas.length}`);
    
    // 2. Check dependency connections
    console.log('\n🔗 CHECKING DEPENDENCY CONNECTIONS:');
    
    let connectedFormulas = 0;
    let totalConnections = 0;
    
    mondayFormulas.forEach(formula => {
      if (formula.name === 'Task 1') return; // Skip default item
      
      const depColumn = formula.column_values.find(cv => cv.id === 'dependency_mkt02nwy');
      if (depColumn && depColumn.value && depColumn.value !== '' && depColumn.value !== '{}') {
        connectedFormulas++;
        try {
          const connections = JSON.parse(depColumn.value);
          if (connections.item_ids && connections.item_ids.length > 0) {
            totalConnections += connections.item_ids.length;
            console.log(`✅ ${formula.name}: ${connections.item_ids.length} ingredient connections`);
          }
        } catch (e) {
          console.log(`⚠️  ${formula.name}: Invalid connection data`);
        }
      } else {
        console.log(`❌ ${formula.name}: No ingredient connections`);
      }
    });
    
    console.log(`\n📊 CONNECTION SUMMARY:`);
    console.log(`Formulas with connections: ${connectedFormulas}/${mondayFormulas.length - 1}`); // -1 for Task 1
    console.log(`Total ingredient connections: ${totalConnections}`);
    console.log(`Expected connections (from DB): ${dbRelationshipsResult.rows[0].count}`);
    
    // 3. Sample missing ingredients
    console.log('\n🧪 SAMPLE MISSING INGREDIENTS:');
    
    const allDbIngredients = await pool.query(`
      SELECT i.name, COUNT(fi.formula_id) as usage_count
      FROM ingredients i
      LEFT JOIN formula_ingredients fi ON i.id = fi.ingredient_id
      GROUP BY i.id, i.name
      ORDER BY COUNT(fi.formula_id) DESC
      LIMIT 20
    `);
    
    const mondayIngredientNames = new Set(mondayIngredients.map(mi => mi.name.toLowerCase()));
    
    console.log('Top 20 database ingredients and their Monday status:');
    allDbIngredients.rows.forEach((ing, i) => {
      const onMonday = mondayIngredientNames.has(ing.name.toLowerCase());
      const status = onMonday ? '✅' : '❌';
      console.log(`${i+1}. ${status} ${ing.name} (used in ${ing.usage_count} formulas)`);
    });
    
    // 4. Check why sync might have failed
    console.log('\n🔍 CHECKING SYNC ISSUES:');
    
    // Check if ingredients board was actually populated
    const recentIngredients = mondayIngredients.slice(0, 5);
    console.log('Recent Monday ingredients:');
    recentIngredients.forEach(ing => {
      console.log(`  • ${ing.name} (ID: ${ing.id})`);
    });
    
    // 5. Show what needs to be done
    console.log('\n🚧 REQUIRED ACTIONS:');
    console.log('1. Run full ingredient sync to populate all 563 ingredients');
    console.log('2. Run full formula sync to populate all 78 formulas');
    console.log('3. Create actual dependency connections between formulas and ingredients');
    console.log('4. Set up the dependency column to point to the ingredients board');
    
    return {
      dbIngredients: dbIngredientsResult.rows[0].count,
      mondayIngredients: mondayIngredients.length,
      dbFormulas: dbFormulasResult.rows[0].count,
      mondayFormulas: mondayFormulas.length,
      connectedFormulas,
      totalConnections
    };
    
  } catch (error) {
    console.error('❌ Error checking missing data:', error.message);
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (require.main === module) {
  checkMissingData();
}

module.exports = { checkMissingData };