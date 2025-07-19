const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function verifyINCIStatus() {
  console.log('🔍 VERIFYING INCI CONNECTION STATUS...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const ingredientsBoardId = '9625733140'; // Ingredients Master Database
    const inciBoardId = '9625740593'; // INCI Master Database
    const ingredientsConnectionColumnId = 'board_relation_mkt0k7xm'; // Ingredients → INCI connection
    
    // Get database stats
    const inciDataQuery = `
      SELECT COUNT(*) as total_with_inci
      FROM ingredients 
      WHERE inci_name IS NOT NULL AND inci_name != ''
    `;
    
    const dbResult = await pool.query(inciDataQuery);
    const expectedConnections = dbResult.rows[0].total_with_inci;
    
    // Get Monday INCI board count
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
    const actualInciItems = mondayInciItems.filter(item => item.name !== 'Task 1');
    
    // Get ingredients with INCI connections
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
    
    let connectedIngredients = 0;
    let totalConnections = 0;
    
    mondayIngredients.forEach(ingredient => {
      const connections = ingredient.column_values?.[0]?.linked_item_ids || [];
      if (connections.length > 0) {
        connectedIngredients++;
        totalConnections += connections.length;
      }
    });
    
    console.log('📊 INCI STATUS SUMMARY:');
    console.log(`   Database ingredients with INCI: ${expectedConnections}`);
    console.log(`   Monday INCI items: ${actualInciItems.length}`);
    console.log(`   Ingredients with INCI connections: ${connectedIngredients}`);
    console.log(`   Total INCI connections: ${totalConnections}`);
    console.log(`   Connection success rate: ${((connectedIngredients / expectedConnections) * 100).toFixed(1)}%`);
    
    if (connectedIngredients >= expectedConnections * 0.95) {
      console.log('\n🎉 EXCELLENT! 95%+ INCI connections achieved!');
      console.log('✅ INCI automation is essentially complete');
    } else if (connectedIngredients >= expectedConnections * 0.85) {
      console.log('\n✅ GREAT! 85%+ INCI connections achieved!');
      console.log('📝 Minor cleanup may be needed');
    } else {
      console.log('\n🔄 INCI automation still in progress...');
      console.log('⏳ Script may still be running or needs restart');
    }
    
    console.log('\n🎯 WHAT THIS ENABLES:');
    console.log('• Formulas → Ingredients → INCI complete chain');
    console.log('• Mirror column will show INCI names on formulas');
    console.log('• Regulatory compliance information available');
    console.log('• Professional cosmetics database complete');
    
  } catch (error) {
    console.error('❌ Error verifying INCI status:', error.message);
  } finally {
    await pool.end();
  }
}

verifyINCIStatus();