const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function automateINCIConnections() {
  console.log('🧬 AUTOMATING INCI CONNECTIONS...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const ingredientsBoardId = '9625733140'; // Ingredients Master Database
    const inciBoardId = '9625740593'; // INCI Master Database
    const inciConnectionColumnId = 'board_relation_mkt0nqcq'; // INCI → Ingredients connection
    const ingredientsConnectionColumnId = 'board_relation_mkt0k7xm'; // Ingredients → INCI connection
    
    console.log('📊 PHASE 1: Getting INCI data from database...');
    
    // Get all ingredients with INCI names from database
    const inciDataQuery = `
      SELECT 
        id,
        name as ingredient_name,
        inci_name,
        category
      FROM ingredients 
      WHERE inci_name IS NOT NULL AND inci_name != ''
      ORDER BY name
    `;
    
    const inciResult = await pool.query(inciDataQuery);
    console.log(`✅ Found ${inciResult.rows.length} ingredients with INCI names\n`);
    
    console.log('📋 PHASE 2: Getting current Monday data...');
    
    // Get current INCI items on Monday
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
    
    // Get current ingredients on Monday
    const mondayIngredientsQuery = `
      query {
        boards(ids: [${ingredientsBoardId}]) {
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
    
    console.log(`📊 Monday data: ${mondayInciItems.length} INCI items, ${mondayIngredients.length} ingredients\n`);
    
    // Create lookup maps
    const inciMap = new Map();
    mondayInciItems.forEach(item => {
      if (item.name !== 'Task 1') { // Skip the default item
        inciMap.set(item.name.toLowerCase().trim(), item.id);
      }
    });
    
    const ingredientMap = new Map();
    mondayIngredients.forEach(item => {
      ingredientMap.set(item.name.toLowerCase().trim(), {
        id: item.id,
        existingConnections: item.column_values?.[0]?.linked_item_ids || []
      });
    });
    
    console.log('🔧 PHASE 3: Creating missing INCI items...');
    
    // Find missing INCI names
    const missingInci = [];
    const uniqueInciNames = new Set();
    
    inciResult.rows.forEach(row => {
      const inciName = row.inci_name.trim();
      if (!uniqueInciNames.has(inciName)) {
        uniqueInciNames.add(inciName);
        if (!inciMap.has(inciName.toLowerCase())) {
          missingInci.push(inciName);
        }
      }
    });
    
    console.log(`📊 Missing INCI items to create: ${missingInci.length}`);
    
    // Create missing INCI items in batches
    let createdInciCount = 0;
    const batchSize = 10;
    
    for (let i = 0; i < missingInci.length; i += batchSize) {
      const batch = missingInci.slice(i, i + batchSize);
      
      for (const inciName of batch) {
        try {
          const createMutation = `
            mutation {
              create_item(
                board_id: ${inciBoardId},
                item_name: "${inciName.replace(/"/g, '\\"')}"
              ) {
                id
              }
            }
          `;
          
          const createResponse = await monday.api(createMutation);
          const newItemId = createResponse.data?.create_item?.id;
          
          if (newItemId) {
            inciMap.set(inciName.toLowerCase(), newItemId);
            createdInciCount++;
            console.log(`   ✅ Created: ${inciName} (ID: ${newItemId})`);
          }
          
          // Rate limiting - faster for efficiency
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`   ❌ Failed to create ${inciName}: ${error.message}`);
        }
      }
      
      console.log(`📊 Created batch ${Math.min(i + batchSize, missingInci.length)}/${missingInci.length}`);
    }
    
    console.log(`\n✅ Created ${createdInciCount} new INCI items`);
    
    console.log('\n🔗 PHASE 4: Connecting ingredients to INCI names...');
    
    let connectedIngredients = 0;
    let skippedIngredients = 0;
    let totalConnections = 0;
    
    for (const row of inciResult.rows) {
      const ingredientName = row.ingredient_name.toLowerCase().trim();
      const inciName = row.inci_name.trim();
      
      const mondayIngredient = ingredientMap.get(ingredientName);
      const mondayInciId = inciMap.get(inciName.toLowerCase());
      
      if (!mondayIngredient) {
        console.log(`⚠️  Ingredient not found on Monday: ${row.ingredient_name}`);
        skippedIngredients++;
        continue;
      }
      
      if (!mondayInciId) {
        console.log(`⚠️  INCI not found on Monday: ${inciName}`);
        skippedIngredients++;
        continue;
      }
      
      // Check if already connected
      if (mondayIngredient.existingConnections.includes(mondayInciId)) {
        console.log(`✅ ${row.ingredient_name} already connected to ${inciName}`);
        skippedIngredients++;
        continue;
      }
      
      console.log(`🔧 Connecting: ${row.ingredient_name} → ${inciName}`);
      
      try {
        // Connect ingredient to INCI
        const columnValues = {};
        columnValues[ingredientsConnectionColumnId] = {
          "item_ids": [mondayInciId]
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
          connectedIngredients++;
          totalConnections++;
          console.log(`   ✅ Connected successfully!`);
        } else {
          console.log(`   ❌ Connection failed`);
          skippedIngredients++;
        }
        
        // Rate limiting - faster for efficiency
        await new Promise(resolve => setTimeout(resolve, 150));
        
      } catch (error) {
        console.error(`   ❌ Error connecting ${row.ingredient_name}: ${error.message}`);
        skippedIngredients++;
      }
    }
    
    console.log('\n🎉 INCI AUTOMATION COMPLETE!');
    console.log(`✅ Created INCI items: ${createdInciCount}`);
    console.log(`✅ Connected ingredients: ${connectedIngredients}`);
    console.log(`⚠️  Skipped: ${skippedIngredients}`);
    console.log(`🔗 Total connections: ${totalConnections}`);
    
    console.log('\n🔍 FINAL VERIFICATION...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verify connections
    const verifyResponse = await monday.api(mondayIngredientsQuery);
    const verifyIngredients = verifyResponse.data?.boards?.[0]?.items_page?.items || [];
    
    let connectedCount = 0;
    verifyIngredients.forEach(ingredient => {
      const connections = ingredient.column_values?.[0]?.linked_item_ids || [];
      if (connections.length > 0) {
        connectedCount++;
      }
    });
    
    console.log(`\n📊 VERIFICATION RESULTS:`);
    console.log(`   Ingredients with INCI connections: ${connectedCount}`);
    console.log(`   Expected connections: ${inciResult.rows.length}`);
    console.log(`   Connection success rate: ${((connectedCount / inciResult.rows.length) * 100).toFixed(1)}%`);
    
    console.log('\n🎯 WHAT THIS ENABLES:');
    console.log('• Ingredients now connected to INCI names');
    console.log('• Mirror column on formulas should populate with INCI data');
    console.log('• Complete traceability: Formulas → Ingredients → INCI');
    console.log('• Regulatory compliance information available');
    console.log('• Professional cosmetics database complete');
    
    console.log('\n💡 NEXT STEPS:');
    console.log('• Check formulas board - INCI Names column should now show data');
    console.log('• Mirror column may take a few minutes to sync');
    console.log('• Full visual relationship mapping now complete');
    
  } catch (error) {
    console.error('❌ Error in INCI automation:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

automateINCIConnections();