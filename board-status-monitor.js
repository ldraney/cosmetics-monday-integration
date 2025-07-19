const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();

async function monitorBoardStatus() {
  console.log('📊 MONDAY.COM BOARD STATUS MONITOR');
  console.log('==================================\n');
  
  try {
    if (!process.env.MONDAY_API_TOKEN) {
      console.error('❌ MONDAY_API_TOKEN environment variable required');
      return;
    }
    
    monday.setToken(process.env.MONDAY_API_TOKEN);
    
    const boardIds = {
      inci: process.env.INCI_BOARD_ID,
      ingredients: process.env.INGREDIENTS_BOARD_ID,
      formulas: process.env.FORMULAS_BOARD_ID,
      pricing: process.env.PRICING_BOARD_ID
    };
    
    console.log('🔗 Board Configuration:');
    Object.entries(boardIds).forEach(([name, id]) => {
      console.log(`  ${name.toUpperCase()}: ${id || 'NOT SET'}`);
    });
    console.log('');
    
    const healthReport = {
      timestamp: new Date().toISOString(),
      boards: {},
      overall_health: 'unknown',
      recommendations: []
    };
    
    // Check each board
    for (const [boardName, boardId] of Object.entries(boardIds)) {
      if (!boardId) {
        console.log(`❌ ${boardName.toUpperCase()}: Board ID not configured`);
        healthReport.boards[boardName] = {
          status: 'missing',
          error: 'Board ID not configured'
        };
        continue;
      }
      
      console.log(`🔍 Checking ${boardName.toUpperCase()} board...`);
      
      try {
        const boardQuery = `
          query {
            boards(ids: [${boardId}]) {
              id
              name
              state
              columns {
                id
                title
                type
              }
              items(limit: 10) {
                id
                name
                column_values {
                  id
                  text
                  value
                }
              }
            }
          }
        `;
        
        const response = await monday.api(boardQuery);
        const board = response.data.boards[0];
        
        if (!board) {
          console.log(`  ❌ Board not found or not accessible`);
          healthReport.boards[boardName] = {
            status: 'not_found',
            error: 'Board not found or not accessible'
          };
          continue;
        }
        
        // Get full item count
        const countQuery = `
          query {
            boards(ids: [${boardId}]) {
              items_count
            }
          }
        `;
        
        const countResponse = await monday.api(countQuery);
        const itemCount = countResponse.data.boards[0]?.items_count || 0;
        
        console.log(`  ✅ Name: ${board.name}`);
        console.log(`  📊 State: ${board.state}`);
        console.log(`  📝 Items: ${itemCount}`);
        console.log(`  🏗️  Columns: ${board.columns.length}`);
        
        // Analyze columns
        const columns = board.columns.map(col => ({
          id: col.id,
          title: col.title,
          type: col.type
        }));
        
        console.log(`  📋 Column Structure:`);
        columns.forEach(col => {
          console.log(`    • ${col.title} (${col.type}) [${col.id}]`);
        });
        
        // Check for expected columns based on board type
        const expectedColumns = getExpectedColumns(boardName);
        const missingColumns = expectedColumns.filter(expected => 
          !columns.some(col => col.title.toLowerCase().includes(expected.toLowerCase()))
        );
        
        if (missingColumns.length > 0) {
          console.log(`  ⚠️  Missing expected columns: ${missingColumns.join(', ')}`);
        }
        
        // Sample data check
        if (board.items.length > 0) {
          console.log(`  🔍 Sample data (first item):`);
          const sampleItem = board.items[0];
          console.log(`    Name: ${sampleItem.name}`);
          
          sampleItem.column_values.slice(0, 3).forEach(cv => {
            const columnTitle = columns.find(c => c.id === cv.id)?.title || cv.id;
            console.log(`    ${columnTitle}: ${cv.text || cv.value || 'empty'}`);
          });
        }
        
        healthReport.boards[boardName] = {
          status: 'healthy',
          name: board.name,
          state: board.state,
          item_count: itemCount,
          column_count: board.columns.length,
          columns: columns,
          missing_columns: missingColumns,
          has_data: board.items.length > 0
        };
        
        console.log('');
        
      } catch (error) {
        console.log(`  ❌ Error: ${error.message}`);
        healthReport.boards[boardName] = {
          status: 'error',
          error: error.message
        };
      }
      
      // Rate limiting delay
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Overall health assessment
    const boardStatuses = Object.values(healthReport.boards).map(b => b.status);
    const healthyCount = boardStatuses.filter(s => s === 'healthy').length;
    const totalBoards = Object.keys(boardIds).filter(key => boardIds[key]).length;
    
    if (healthyCount === totalBoards) {
      healthReport.overall_health = 'excellent';
    } else if (healthyCount >= totalBoards * 0.75) {
      healthReport.overall_health = 'good';
    } else if (healthyCount >= totalBoards * 0.5) {
      healthReport.overall_health = 'fair';
    } else {
      healthReport.overall_health = 'poor';
    }
    
    // Generate recommendations
    healthReport.recommendations = generateRecommendations(healthReport.boards);
    
    console.log('📈 OVERALL HEALTH ASSESSMENT');
    console.log('============================');
    console.log(`Status: ${healthReport.overall_health.toUpperCase()}`);
    console.log(`Healthy boards: ${healthyCount}/${totalBoards}`);
    
    if (healthReport.recommendations.length > 0) {
      console.log('\\n💡 RECOMMENDATIONS:');
      healthReport.recommendations.forEach((rec, i) => {
        console.log(`${i + 1}. ${rec}`);
      });
    }
    
    // Check readiness for pricing upload
    console.log('\\n🚀 READINESS CHECK FOR PRICING UPLOAD:');
    const readiness = checkPricingReadiness(healthReport.boards);
    console.log(`Status: ${readiness.ready ? '✅ READY' : '❌ NOT READY'}`);
    if (!readiness.ready) {
      console.log(`Reason: ${readiness.reason}`);
    }
    
    // Save report
    const fs = require('fs');
    fs.writeFileSync('board-health-report.json', JSON.stringify(healthReport, null, 2));
    console.log('\\n📄 Full report saved to: board-health-report.json');
    
    return healthReport;
    
  } catch (error) {
    console.error('❌ Monitor error:', error.message);
    return null;
  }
}

function getExpectedColumns(boardName) {
  const expectedColumns = {
    inci: ['category', 'usage count', 'status'],
    ingredients: ['inci names', 'price per kg', 'usage count', 'status'],
    formulas: ['ingredients', 'total cost per kg', 'status', 'percentage'],
    pricing: ['inci name', 'usage count', 'cost per kg', 'priority']
  };
  
  return expectedColumns[boardName] || [];
}

function generateRecommendations(boards) {
  const recommendations = [];
  
  Object.entries(boards).forEach(([boardName, board]) => {
    if (board.status === 'missing') {
      recommendations.push(`Configure ${boardName.toUpperCase()}_BOARD_ID in .env file`);
    } else if (board.status === 'not_found') {
      recommendations.push(`Recreate ${boardName} board - it may have been deleted`);
    } else if (board.status === 'error') {
      recommendations.push(`Check API permissions for ${boardName} board`);
    } else if (board.status === 'healthy') {
      if (board.missing_columns.length > 0) {
        recommendations.push(`Add missing columns to ${boardName}: ${board.missing_columns.join(', ')}`);
      }
      if (!board.has_data) {
        recommendations.push(`Populate ${boardName} board with data`);
      }
    }
  });
  
  return recommendations;
}

function checkPricingReadiness(boards) {
  // Check if ingredients board is ready for pricing upload
  const ingredients = boards.ingredients;
  
  if (!ingredients || ingredients.status !== 'healthy') {
    return { ready: false, reason: 'Ingredients board not healthy' };
  }
  
  if (ingredients.item_count < 100) {
    return { ready: false, reason: `Only ${ingredients.item_count} ingredients populated, expected ~563` };
  }
  
  const hasPricingColumn = ingredients.columns.some(col => 
    col.title.toLowerCase().includes('price') && col.type === 'numbers'
  );
  
  if (!hasPricingColumn) {
    return { ready: false, reason: 'Missing pricing column in ingredients board' };
  }
  
  return { ready: true, reason: 'All checks passed' };
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const watch = args.includes('--watch');
  
  if (watch) {
    console.log('👁️  Starting continuous monitoring (Ctrl+C to stop)...');
    setInterval(async () => {
      await monitorBoardStatus();
      console.log('\\n⏰ Next check in 30 seconds...\\n');
    }, 30000);
  } else {
    monitorBoardStatus();
  }
}

module.exports = { monitorBoardStatus };