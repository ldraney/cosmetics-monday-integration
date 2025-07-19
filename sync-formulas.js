const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();

async function syncFormulasToMonday(options = {}) {
  console.log('🚀 Starting Monday.com formula sync...');
  
  const { dryRun = false, filter = '', batchSize = 10 } = options;
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
  }
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Validate API token
    if (!process.env.MONDAY_API_TOKEN) {
      console.error('❌ MONDAY_API_TOKEN environment variable required');
      console.log('💡 Get your token from: https://monday.com/developers/v2');
      return;
    }
    
    monday.setToken(process.env.MONDAY_API_TOKEN);
    
    // Get formulas from database
    console.log('📊 Fetching formulas from local database...');
    
    let whereClause = '';
    if (filter) {
      if (filter.includes('status=approved')) {
        whereClause = "WHERE f.status = 'approved'";
      } else if (filter.includes('status=needs_review')) {
        whereClause = "WHERE f.status = 'needs_review'";
      }
    }
    
    const formulasQuery = `
      SELECT 
        f.id,
        f.name,
        f.version,
        f.status,
        f.review_reasons,
        ROUND(SUM(fi.percentage)::numeric, 2) as total_percentage,
        COUNT(fi.id) as ingredient_count,
        f.created_date,
        f.updated_date
      FROM formulas f
      LEFT JOIN formula_ingredients fi ON f.id = fi.formula_id
      ${whereClause}
      GROUP BY f.id, f.name, f.version, f.status, f.review_reasons, f.created_date, f.updated_date
      ORDER BY f.id
    `;
    
    const result = await pool.query(formulasQuery);
    console.log(`✅ Found ${result.rows.length} formulas to sync`);
    
    if (dryRun) {
      console.log('\n📋 PREVIEW - Formulas that would be synced:');
      result.rows.slice(0, 10).forEach(formula => {
        console.log(`  • ${formula.name} v${formula.version} (${formula.status}) - ${formula.total_percentage}%`);
      });
      console.log(`\n🔍 Total: ${result.rows.length} formulas`);
      return;
    }
    
    // Find or create formulas board
    console.log('🔍 Checking for existing Monday boards...');
    
    const boardsQuery = `
      query {
        boards(limit: 50) {
          id
          name
          description
        }
      }
    `;
    
    const boardsResponse = await monday.api(boardsQuery);
    
    let formulasBoard = boardsResponse.data.boards.find(board => 
      board.name.toLowerCase().includes('formula') || 
      board.name.toLowerCase().includes('cosmetic')
    );
    
    if (!formulasBoard && !process.env.FORMULAS_BOARD_ID) {
      console.log('🆕 Creating new Cosmetics Formulas board...');
      
      const createBoardMutation = `
        mutation {
          create_board (
            board_name: "Cosmetics Formulas Database",
            board_kind: public,
            description: "Complete formulas with ingredients and percentages - Synced from local database"
          ) {
            id
            name
          }
        }
      `;
      
      const newBoardResponse = await monday.api(createBoardMutation);
      formulasBoard = newBoardResponse.data.create_board;
      console.log(`✅ Created board: ${formulasBoard.name} (ID: ${formulasBoard.id})`);
    } else if (process.env.FORMULAS_BOARD_ID) {
      formulasBoard = { id: process.env.FORMULAS_BOARD_ID, name: 'Existing Board' };
      console.log(`✅ Using configured board ID: ${formulasBoard.id}`);
    } else {
      console.log(`✅ Using existing board: ${formulasBoard.name} (ID: ${formulasBoard.id})`);
    }
    
    // Sync formulas in batches
    console.log(`🔄 Syncing formulas to Monday board (batch size: ${batchSize})...`);
    
    let syncedCount = 0;
    const totalFormulas = result.rows.length;
    
    for (let i = 0; i < totalFormulas; i += batchSize) {
      const batch = result.rows.slice(i, i + batchSize);
      
      for (const formula of batch) {
        try {
          const statusColor = formula.status === 'approved' ? 'green' : 'orange';
          const reviewNotes = formula.review_reasons ? formula.review_reasons.join(', ') : 'None';
          
          const itemMutation = `
            mutation {
              create_item (
                board_id: ${formulasBoard.id},
                item_name: "${formula.name.replace(/"/g, '\\"')} v${formula.version}",
                column_values: "{\\"text\\": \\"ID: ${formula.id}\\\\nStatus: ${formula.status}\\\\nTotal: ${formula.total_percentage}%\\\\nIngredients: ${formula.ingredient_count}\\\\nNotes: ${reviewNotes.replace(/"/g, '\\"')}\\"}"
              ) {
                id
                name
              }
            }
          `;
          
          const itemResponse = await monday.api(itemMutation);
          syncedCount++;
          
        } catch (error) {
          console.error(`❌ Error syncing ${formula.name}:`, error.message);
        }
      }
      
      console.log(`  ✅ Synced ${Math.min(syncedCount, totalFormulas)} / ${totalFormulas} formulas...`);
      
      // Rate limiting delay
      if (i + batchSize < totalFormulas) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log(`\n🎉 Sync complete!`);
    console.log(`📊 Successfully synced ${syncedCount} formulas to Monday board`);
    console.log(`🔗 View board: https://monday.com/boards/${formulasBoard.id}`);
    
    // Summary statistics
    const approvedCount = result.rows.filter(f => f.status === 'approved').length;
    const needsReviewCount = result.rows.filter(f => f.status === 'needs_review').length;
    const avgPercentage = result.rows.reduce((sum, f) => sum + parseFloat(f.total_percentage), 0) / result.rows.length;
    
    console.log(`\n📈 Summary:`);
    console.log(`  • Approved formulas: ${approvedCount}`);
    console.log(`  • Needs review: ${needsReviewCount}`);
    console.log(`  • Average percentage: ${avgPercentage.toFixed(2)}%`);
    
  } catch (error) {
    console.error('❌ Error during sync:', error.message);
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
    } else if (args[i] === '--filter' && args[i + 1]) {
      options.filter = args[i + 1];
      i++;
    } else if (args[i] === '--batch-size' && args[i + 1]) {
      options.batchSize = parseInt(args[i + 1]);
      i++;
    }
  }
  
  // Check environment
  if (!process.env.MONDAY_API_TOKEN) {
    console.log('\n🔑 Setup Required:');
    console.log('1. Copy .env.example to .env');
    console.log('2. Add your Monday.com API token to .env');
    console.log('3. Run again\n');
    process.exit(1);
  }
  
  syncFormulasToMonday(options);
}

module.exports = { syncFormulasToMonday };