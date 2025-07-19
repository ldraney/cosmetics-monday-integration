const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function connectFormulaIngredients(options = {}) {
  console.log('🔗 Connecting formulas to ingredients on Monday.com...\n');
  
  const { dryRun = false, maxFormulas = 10 } = options;
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made\n');
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const formulasBoardId = process.env.FORMULAS_BOARD_ID;
    const ingredientsBoardId = process.env.INGREDIENTS_BOARD_ID;
    
    if (!formulasBoardId || !ingredientsBoardId) {
      console.error('❌ Missing board IDs in environment variables');
      return;
    }
    
    // Get formulas with their ingredients from database
    console.log('📊 Fetching formulas with ingredients from database...');
    
    const formulaIngredientsQuery = `
      SELECT 
        f.id as formula_id,
        f.name as formula_name,
        f.version,
        fi.percentage,
        i.id as ingredient_id,
        i.name as ingredient_name,
        i.inci_name
      FROM formulas f
      JOIN formula_ingredients fi ON f.id = fi.formula_id
      JOIN ingredients i ON fi.ingredient_id = i.id
      WHERE f.status = 'approved'
      ORDER BY f.id, fi.percentage DESC
      LIMIT ${maxFormulas * 20}
    `;
    
    const result = await pool.query(formulaIngredientsQuery);
    console.log(`✅ Found ${result.rows.length} formula-ingredient relationships`);
    
    // Group by formula
    const formulaGroups = {};
    result.rows.forEach(row => {
      if (!formulaGroups[row.formula_id]) {
        formulaGroups[row.formula_id] = {
          formula_name: row.formula_name,
          version: row.version,
          ingredients: []
        };
      }
      formulaGroups[row.formula_id].ingredients.push({
        ingredient_id: row.ingredient_id,
        ingredient_name: row.ingredient_name,
        percentage: row.percentage,
        inci_name: row.inci_name
      });
    });
    
    const formulas = Object.keys(formulaGroups).slice(0, maxFormulas);
    console.log(`🧪 Processing ${formulas.length} formulas`);
    
    // Get Monday board items for both boards
    console.log('📋 Getting Monday board items...');
    
    // Get formulas from Monday
    const formulasQuery = `
      query {
        boards(ids: [${formulasBoardId}]) {
          items_page(limit: 200) {
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
    console.log(`📊 Found ${mondayFormulas.length} formulas on Monday`);
    
    // Get ingredients from Monday
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
    console.log(`🧪 Found ${mondayIngredients.length} ingredients on Monday`);
    
    if (dryRun) {
      console.log('\\n📋 PREVIEW - Connections that would be made:');
      formulas.slice(0, 3).forEach(formulaId => {
        const formula = formulaGroups[formulaId];
        console.log(`\\n🧪 ${formula.formula_name} v${formula.version}:`);
        formula.ingredients.slice(0, 5).forEach(ing => {
          console.log(`  • ${ing.ingredient_name}: ${ing.percentage}%`);
        });
        if (formula.ingredients.length > 5) {
          console.log(`  ... and ${formula.ingredients.length - 5} more ingredients`);
        }
      });
      return;
    }
    
    // Process each formula
    let processedCount = 0;
    let connectionsCreated = 0;
    
    for (const formulaId of formulas) {
      const formula = formulaGroups[formulaId];
      
      // Find matching Monday formula
      const mondayFormula = mondayFormulas.find(mf => 
        mf.name.toLowerCase().includes(formula.formula_name.toLowerCase()) ||
        formula.formula_name.toLowerCase().includes(mf.name.toLowerCase())
      );
      
      if (!mondayFormula) {
        console.log(`⚠️  No Monday item found for formula: ${formula.formula_name}`);
        continue;
      }
      
      console.log(`\\n🔗 Processing: ${formula.formula_name} (${formula.ingredients.length} ingredients)`);
      
      // Find matching ingredient items and create connections
      const ingredientConnections = [];
      
      for (const ingredient of formula.ingredients) {
        const mondayIngredient = mondayIngredients.find(mi => 
          mi.name.toLowerCase().includes(ingredient.ingredient_name.toLowerCase()) ||
          ingredient.ingredient_name.toLowerCase().includes(mi.name.toLowerCase())
        );
        
        if (mondayIngredient) {
          ingredientConnections.push({
            item_id: mondayIngredient.id,
            percentage: ingredient.percentage
          });
          console.log(`  ✅ Matched: ${ingredient.ingredient_name} (${ingredient.percentage}%)`);
        } else {
          console.log(`  ⚠️  No match: ${ingredient.ingredient_name}`);
        }
      }
      
      if (ingredientConnections.length === 0) {
        console.log(`  ❌ No ingredient matches found for ${formula.formula_name}`);
        continue;
      }
      
      // Check if formulas board has a dependency column for ingredients
      // First, we need to get the board structure to find the dependency column
      const boardStructureQuery = `
        query {
          boards(ids: [${formulasBoardId}]) {
            columns {
              id
              title
              type
            }
          }
        }
      `;
      
      const boardStructureResponse = await monday.api(boardStructureQuery);
      const columns = boardStructureResponse.data?.boards?.[0]?.columns || [];
      const dependencyColumn = columns.find(col => 
        col.type === 'dependency' || 
        col.title.toLowerCase().includes('ingredient')
      );
      
      if (!dependencyColumn) {
        console.log(`❌ No dependency column found on formulas board for ingredient connections`);
        console.log(`💡 You need to add a dependency column that connects to the ingredients board`);
        continue;
      }
      
      console.log(`📋 Using dependency column: ${dependencyColumn.title} (${dependencyColumn.id})`);
      
      // Create the connection using dependency column
      try {
        // For dependency columns, we need to pass the connected item IDs in a specific format
        const connectedItemIds = ingredientConnections.slice(0, 5).map(conn => conn.item_id); // Limit to top 5 ingredients
        const dependencyValue = {
          "item_ids": connectedItemIds
        };
        
        const updateMutation = `
          mutation {
            change_column_value (
              board_id: ${formulasBoardId},
              item_id: ${mondayFormula.id},
              column_id: "${dependencyColumn.id}",
              value: "${JSON.stringify(dependencyValue).replace(/"/g, '\\"')}"
            ) {
              id
            }
          }
        `;
        
        await monday.api(updateMutation);
        connectionsCreated += ingredientConnections.length;
        console.log(`  🎉 Connected ${ingredientConnections.length} ingredients to ${formula.formula_name}`);
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`  ❌ Failed to connect ingredients for ${formula.formula_name}: ${error.message}`);
      }
      
      processedCount++;
      
      if (processedCount >= maxFormulas) {
        console.log(`\\n⏸️  Reached limit of ${maxFormulas} formulas`);
        break;
      }
    }
    
    console.log(`\\n🎉 Connection process complete!`);
    console.log(`📊 Processed: ${processedCount} formulas`);
    console.log(`🔗 Connections created: ${connectionsCreated} formula-ingredient links`);
    
  } catch (error) {
    console.error('❌ Error connecting formulas to ingredients:', error.message);
    if (error.response?.data) {
      console.error('API Response:', error.response.data);
    }
  } finally {
    await pool.end();
  }
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      options.dryRun = true;
    } else if (args[i] === '--max-formulas' && args[i + 1]) {
      options.maxFormulas = parseInt(args[i + 1]);
      i++;
    }
  }
  
  if (options.dryRun) {
    console.log('🔍 Running in dry-run mode...');
  }
  
  connectFormulaIngredients(options);
}

module.exports = { connectFormulaIngredients };