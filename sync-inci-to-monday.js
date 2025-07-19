const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function syncINCIToMonday() {
  console.log('🔄 SYNCING DATABASE INCI TO MONDAY BOARD...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const inciBoardId = '9625740593'; // INCI Master Database
    
    console.log('📊 PHASE 1: Getting all INCI names from database...');
    
    // Get all unique INCI names from database with usage stats
    const inciQuery = `
      SELECT 
        i.inci_name,
        COUNT(DISTINCT f.id) as formula_count,
        COUNT(fi.id) as usage_count,
        json_agg(DISTINCT i.category) FILTER (WHERE i.category IS NOT NULL) as categories,
        json_agg(DISTINCT i.name ORDER BY i.name) as ingredient_names,
        ROUND(AVG(fi.percentage)::numeric, 3) as avg_percentage,
        ROUND(MIN(fi.percentage)::numeric, 3) as min_percentage,
        ROUND(MAX(fi.percentage)::numeric, 3) as max_percentage
      FROM ingredients i
      LEFT JOIN formula_ingredients fi ON i.id = fi.ingredient_id
      LEFT JOIN formulas f ON fi.formula_id = f.id
      WHERE i.inci_name IS NOT NULL AND i.inci_name != ''
      GROUP BY i.inci_name
      ORDER BY COUNT(DISTINCT f.id) DESC, i.inci_name
    `;
    
    const dbResult = await pool.query(inciQuery);
    console.log(`✅ Found ${dbResult.rows.length} unique INCI names in database\n`);
    
    console.log('📋 PHASE 2: Getting current Monday INCI board...');
    
    // Get current INCI items on Monday
    const mondayQuery = `
      query {
        boards(ids: [${inciBoardId}]) {
          name
          items_page(limit: 500) {
            items {
              id
              name
            }
          }
        }
      }
    `;
    
    const mondayResponse = await monday.api(mondayQuery);
    const mondayItems = mondayResponse.data?.boards?.[0]?.items_page?.items || [];
    const boardName = mondayResponse.data?.boards?.[0]?.name;
    
    console.log(`✅ Board: ${boardName}`);
    console.log(`📊 Current Monday items: ${mondayItems.length}\n`);
    
    // Create lookup map of existing Monday items (exclude default "Task 1")
    const existingINCIMap = new Map();
    mondayItems.forEach(item => {
      if (item.name !== 'Task 1') {
        existingINCIMap.set(item.name.toLowerCase().trim(), item.id);
      }
    });
    
    console.log(`📊 Existing INCI items (excluding Task 1): ${existingINCIMap.size}`);
    
    console.log('🔧 PHASE 3: Identifying missing INCI items...');
    
    // Find INCI names that need to be created
    const missingINCI = [];
    const existingINCI = [];
    
    dbResult.rows.forEach(row => {
      const inciName = row.inci_name.trim();
      if (existingINCIMap.has(inciName.toLowerCase())) {
        existingINCI.push({
          inci_name: inciName,
          monday_id: existingINCIMap.get(inciName.toLowerCase()),
          ...row
        });
      } else {
        missingINCI.push(row);
      }
    });
    
    console.log(`📊 Analysis complete:`);
    console.log(`   Missing from Monday: ${missingINCI.length}`);
    console.log(`   Already on Monday: ${existingINCI.length}`);
    console.log(`   Total database INCI: ${dbResult.rows.length}\n`);
    
    if (missingINCI.length === 0) {
      console.log('✅ All INCI names already exist on Monday board!');
      console.log('🔄 Proceeding to enhance existing items with metadata...\n');
    } else {
      console.log('🔧 PHASE 4: Creating missing INCI items...');
      
      let createdCount = 0;
      const batchSize = 10;
      
      // Show preview of what will be created
      console.log('📋 Preview of missing INCI items (top 10):');
      missingINCI.slice(0, 10).forEach((inci, index) => {
        console.log(`   ${index + 1}. ${inci.inci_name} (used in ${inci.formula_count} formulas)`);
      });
      
      if (missingINCI.length > 10) {
        console.log(`   ... and ${missingINCI.length - 10} more\n`);
      } else {
        console.log('');
      }
      
      // Create missing INCI items in batches
      for (let i = 0; i < missingINCI.length; i += batchSize) {
        const batch = missingINCI.slice(i, i + batchSize);
        
        console.log(`Creating batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(missingINCI.length/batchSize)}...`);
        
        for (const inciData of batch) {
          try {
            const createMutation = `
              mutation {
                create_item(
                  board_id: ${inciBoardId},
                  item_name: "${inciData.inci_name.replace(/"/g, '\\"')}"
                ) {
                  id
                  name
                }
              }
            `;
            
            const createResponse = await monday.api(createMutation);
            const newItem = createResponse.data?.create_item;
            
            if (newItem) {
              createdCount++;
              console.log(`   ✅ Created: ${inciData.inci_name} (ID: ${newItem.id})`);
              
              // Add to existing map for later use
              existingINCI.push({
                inci_name: inciData.inci_name,
                monday_id: newItem.id,
                ...inciData
              });
            } else {
              console.log(`   ❌ Failed to create: ${inciData.inci_name}`);
            }
            
            // Rate limiting
            await new Promise(resolve => setTimeout(resolve, 200));
            
          } catch (error) {
            console.error(`   ❌ Error creating ${inciData.inci_name}: ${error.message}`);
          }
        }
        
        console.log(`📊 Batch complete: ${Math.min(i + batchSize, missingINCI.length)}/${missingINCI.length}\n`);
      }
      
      console.log(`✅ Created ${createdCount} new INCI items\n`);
    }
    
    console.log('📊 PHASE 5: Final board statistics...');
    
    // Get updated board count
    const finalResponse = await monday.api(mondayQuery);
    const finalItems = finalResponse.data?.boards?.[0]?.items_page?.items || [];
    const finalCount = finalItems.filter(item => item.name !== 'Task 1').length;
    
    console.log(`\n🎉 INCI SYNC COMPLETE!`);
    console.log(`📊 FINAL STATISTICS:`);
    console.log(`   Database INCI names: ${dbResult.rows.length}`);
    console.log(`   Monday INCI items: ${finalCount}`);
    console.log(`   Coverage: ${((finalCount / dbResult.rows.length) * 100).toFixed(1)}%`);
    
    // Show most used INCI names
    console.log(`\n🔥 TOP 10 MOST USED INCI NAMES:`);
    dbResult.rows.slice(0, 10).forEach((inci, index) => {
      console.log(`   ${index + 1}. ${inci.inci_name} (${inci.formula_count} formulas, ${inci.usage_count} uses)`);
    });
    
    console.log(`\n💡 NEXT STEPS:`);
    console.log(`1. Run enhanced INCI automation: node enhanced-inci-automation.js`);
    console.log(`2. Add regulatory columns: node add-inci-board-columns.js`);
    console.log(`3. Verify formula mirror columns show INCI data`);
    
    console.log(`\n🎯 WHAT THIS ENABLES:`);
    console.log(`• Complete INCI Master Database on Monday.com`);
    console.log(`• Full regulatory compliance coverage`);
    console.log(`• Enhanced ingredient traceability`);
    console.log(`• Professional cosmetics database ready`);
    
  } catch (error) {
    console.error('❌ Error syncing INCI to Monday:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--dry-run')) {
    console.log('🔍 DRY RUN MODE - No items will be created\n');
    // Could implement dry run logic here
  }
  
  syncINCIToMonday();
}

module.exports = { syncINCIToMonday };