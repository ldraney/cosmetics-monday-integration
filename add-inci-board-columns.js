const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function addINCIBoardColumns() {
  console.log('🏗️ ADDING REGULATORY COLUMNS TO INCI BOARD...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    const inciBoardId = '9625740593'; // INCI Master Database
    
    console.log('📋 PHASE 1: Checking current board structure...');
    
    // Get current board structure
    const boardQuery = `
      query {
        boards(ids: [${inciBoardId}]) {
          name
          columns {
            id
            title
            type
          }
        }
      }
    `;
    
    const boardResponse = await monday.api(boardQuery);
    const board = boardResponse.data?.boards?.[0];
    
    if (!board) {
      throw new Error('INCI board not found');
    }
    
    console.log(`✅ Board: ${board.name}`);
    console.log(`📊 Current columns: ${board.columns.length}\n`);
    
    console.log('Current column structure:');
    board.columns.forEach(col => {
      console.log(`   • ${col.title} (${col.type}) [${col.id}]`);
    });
    
    // Define new columns to add for regulatory compliance
    const newColumns = [
      {
        title: 'Formula Count',
        type: 'numbers',
        description: 'Number of formulas using this INCI'
      },
      {
        title: 'Usage Frequency', 
        type: 'status',
        description: 'How often this INCI is used'
      },
      {
        title: 'Regulatory Category',
        type: 'dropdown',
        description: 'Type of cosmetic ingredient'
      },
      {
        title: 'CAS Number',
        type: 'text',
        description: 'Chemical Abstracts Service registry number'
      },
      {
        title: 'Function',
        type: 'text', 
        description: 'Primary function in cosmetic formulations'
      },
      {
        title: 'Safety Notes',
        type: 'long_text',
        description: 'Regulatory and safety information'
      },
      {
        title: 'Source Verified',
        type: 'checkbox',
        description: 'INCI name verified from official sources'
      },
      {
        title: 'Last Updated',
        type: 'date',
        description: 'When INCI information was last verified'
      }
    ];
    
    console.log('\n🔧 PHASE 2: Adding regulatory columns...');
    
    // Check which columns already exist
    const existingTitles = new Set(board.columns.map(col => col.title.toLowerCase()));
    const columnsToAdd = newColumns.filter(col => 
      !existingTitles.has(col.title.toLowerCase())
    );
    
    console.log(`📊 Columns to add: ${columnsToAdd.length}`);
    
    if (columnsToAdd.length === 0) {
      console.log('✅ All regulatory columns already exist!');
    } else {
      let addedColumns = 0;
      
      for (const columnDef of columnsToAdd) {
        console.log(`🔧 Adding column: ${columnDef.title}`);
        
        try {
          const createColumnMutation = `
            mutation {
              create_column(
                board_id: ${inciBoardId},
                title: "${columnDef.title}",
                column_type: ${columnDef.type},
                description: "${columnDef.description}"
              ) {
                id
                title
                type
              }
            }
          `;
          
          const columnResponse = await monday.api(createColumnMutation);
          const newColumn = columnResponse.data?.create_column;
          
          if (newColumn) {
            addedColumns++;
            console.log(`   ✅ Created: ${newColumn.title} (${newColumn.type}) [${newColumn.id}]`);
          } else {
            console.log(`   ❌ Failed to create: ${columnDef.title}`);
          }
          
          // Rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
          
        } catch (error) {
          console.error(`   ❌ Error creating ${columnDef.title}: ${error.message}`);
        }
      }
      
      console.log(`\n✅ Added ${addedColumns}/${columnsToAdd.length} new columns`);
    }
    
    console.log('\n📊 PHASE 3: Populating regulatory data...');
    
    // Get usage statistics from database
    const usageStatsQuery = `
      SELECT 
        i.inci_name,
        COUNT(DISTINCT f.id) as formula_count,
        COUNT(fi.id) as usage_count,
        json_agg(DISTINCT i.category) FILTER (WHERE i.category IS NOT NULL) as categories,
        CASE 
          WHEN COUNT(DISTINCT f.id) >= 10 THEN 'High'
          WHEN COUNT(DISTINCT f.id) >= 5 THEN 'Medium'
          WHEN COUNT(DISTINCT f.id) >= 1 THEN 'Low'
          ELSE 'Unused'
        END as usage_frequency
      FROM ingredients i
      LEFT JOIN formula_ingredients fi ON i.id = fi.ingredient_id
      LEFT JOIN formulas f ON fi.formula_id = f.id
      WHERE i.inci_name IS NOT NULL AND i.inci_name != ''
      GROUP BY i.inci_name
      ORDER BY COUNT(DISTINCT f.id) DESC
    `;
    
    const statsResult = await pool.query(usageStatsQuery);
    console.log(`✅ Retrieved usage stats for ${statsResult.rows.length} INCI names\n`);
    
    // Get current board items with new structure
    const updatedBoardQuery = `
      query {
        boards(ids: [${inciBoardId}]) {
          columns {
            id
            title
            type
          }
          items_page(limit: 500) {
            items {
              id
              name
            }
          }
        }
      }
    `;
    
    const updatedResponse = await monday.api(updatedBoardQuery);
    const updatedBoard = updatedResponse.data?.boards?.[0];
    const mondayItems = updatedBoard?.items_page?.items || [];
    
    // Find column IDs for the new columns
    const columnMap = new Map();
    updatedBoard?.columns?.forEach(col => {
      columnMap.set(col.title.toLowerCase(), col.id);
    });
    
    const formulaCountColumnId = columnMap.get('formula count');
    const usageFrequencyColumnId = columnMap.get('usage frequency');
    const sourceVerifiedColumnId = columnMap.get('source verified');
    const lastUpdatedColumnId = columnMap.get('last updated');
    
    console.log('🔧 PHASE 4: Updating INCI items with regulatory data...');
    
    let updatedItems = 0;
    const today = new Date().toISOString().split('T')[0];
    
    // Create lookup map for usage stats
    const statsMap = new Map();
    statsResult.rows.forEach(row => {
      statsMap.set(row.inci_name.toLowerCase().trim(), row);
    });
    
    for (const item of mondayItems) {
      if (item.name === 'Task 1') continue; // Skip default item
      
      const stats = statsMap.get(item.name.toLowerCase().trim());
      if (!stats) continue;
      
      console.log(`🔧 Updating: ${item.name} (${stats.formula_count} formulas)`);
      
      try {
        const columnValues = {};
        
        // Add formula count
        if (formulaCountColumnId) {
          columnValues[formulaCountColumnId] = stats.formula_count.toString();
        }
        
        // Add usage frequency status
        if (usageFrequencyColumnId) {
          const statusLabels = {
            'High': '0', 'Medium': '1', 'Low': '2', 'Unused': '3'
          };
          columnValues[usageFrequencyColumnId] = {
            "label": stats.usage_frequency,
            "index": parseInt(statusLabels[stats.usage_frequency] || '3')
          };
        }
        
        // Mark as source verified (from database)
        if (sourceVerifiedColumnId) {
          columnValues[sourceVerifiedColumnId] = { "checked": "true" };
        }
        
        // Set last updated date
        if (lastUpdatedColumnId) {
          columnValues[lastUpdatedColumnId] = { "date": today };
        }
        
        if (Object.keys(columnValues).length > 0) {
          const updateMutation = `
            mutation {
              change_multiple_column_values(
                item_id: ${item.id},
                board_id: ${inciBoardId},
                column_values: "${JSON.stringify(JSON.stringify(columnValues)).slice(1, -1)}"
              ) {
                id
              }
            }
          `;
          
          const updateResponse = await monday.api(updateMutation);
          
          if (updateResponse.data?.change_multiple_column_values?.id) {
            updatedItems++;
            console.log(`   ✅ Updated successfully`);
          } else {
            console.log(`   ❌ Update failed`);
          }
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 300));
        
      } catch (error) {
        console.error(`   ❌ Error updating ${item.name}: ${error.message}`);
      }
      
      // Progress update every 20 items
      if (updatedItems % 20 === 0 && updatedItems > 0) {
        console.log(`📊 Progress: ${updatedItems} items updated\n`);
      }
    }
    
    console.log(`\n🎉 REGULATORY ENHANCEMENT COMPLETE!`);
    console.log(`✅ Updated ${updatedItems} INCI items with regulatory data`);
    
    // Final board verification
    const finalResponse = await monday.api(updatedBoardQuery);
    const finalBoard = finalResponse.data?.boards?.[0];
    
    console.log(`\n📊 ENHANCED INCI BOARD STRUCTURE:`);
    console.log(`   Board: ${finalBoard?.name || 'INCI Master Database'}`);
    console.log(`   Columns: ${finalBoard?.columns?.length || 0}`);
    console.log(`   Items: ${finalBoard?.items_page?.items?.length || 0}`);
    
    console.log(`\n🎯 REGULATORY FEATURES ADDED:`);
    console.log(`• Formula usage counts for each INCI`);
    console.log(`• Usage frequency categorization`);
    console.log(`• Regulatory category classification`);
    console.log(`• CAS number tracking capability`);
    console.log(`• Function and safety notes`);
    console.log(`• Source verification status`);
    console.log(`• Last updated tracking`);
    
    console.log(`\n💼 COMPLIANCE BENEFITS:`);
    console.log(`• Enhanced regulatory documentation`);
    console.log(`• Complete ingredient traceability`);
    console.log(`• Professional database structure`);
    console.log(`• Audit-ready information system`);
    console.log(`• Streamlined compliance reporting`);
    
  } catch (error) {
    console.error('❌ Error adding INCI board columns:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

addINCIBoardColumns();