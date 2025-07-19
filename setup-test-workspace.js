const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();

async function setupTestWorkspace() {
  console.log('🚀 Setting up Monday.com Test Workspace for Cosmetics Data...');
  
  if (!process.env.MONDAY_API_TOKEN) {
    console.log('\n🔑 MONDAY API TOKEN REQUIRED');
    console.log('1. Go to: https://monday.com/developers/v2');
    console.log('2. Create a new app or use existing');
    console.log('3. Generate API token with read/write permissions');
    console.log('4. Edit .env file and add: MONDAY_API_TOKEN=your_token_here');
    console.log('5. Run this script again\n');
    return;
  }
  
  monday.setToken(process.env.MONDAY_API_TOKEN);
  
  try {
    // Check current user and workspaces
    console.log('👤 Checking your Monday.com account...');
    
    const userQuery = `
      query {
        me {
          id
          name
          email
        }
        boards(limit: 10) {
          id
          name
          workspace {
            id
            name
          }
        }
      }
    `;
    
    const userResponse = await monday.api(userQuery);
    const user = userResponse.data.me;
    const boards = userResponse.data.boards;
    
    console.log(`✅ Connected as: ${user.name} (${user.email})`);
    
    // Show existing workspaces
    const workspaces = [...new Set(boards.map(b => b.workspace).filter(w => w))];
    console.log(`\n📂 Your existing workspaces:`);
    workspaces.forEach(ws => {
      const boardCount = boards.filter(b => b.workspace?.id === ws.id).length;
      console.log(`  • ${ws.name} (ID: ${ws.id}) - ${boardCount} boards`);
    });
    
    console.log(`\n🆕 Creating new test workspace for cosmetics data...`);
    
    // Create a new workspace for cosmetics testing
    const createWorkspaceMutation = `
      mutation {
        create_workspace (
          name: "Cosmetics Testing Lab",
          kind: open,
          description: "Test workspace for cosmetics formula and ingredient data"
        ) {
          id
          name
        }
      }
    `;
    
    const workspaceResponse = await monday.api(createWorkspaceMutation);
    const targetWorkspace = workspaceResponse.data.create_workspace;
    console.log(`✅ Created new workspace: ${targetWorkspace.name} (ID: ${targetWorkspace.id})`);
    
    // Create test boards for cosmetics data
    console.log(`\n🏗️  Creating cosmetics test boards...`);
    
    // 1. Create Formulas Board in new workspace
    const formulasBoardMutation = `
      mutation {
        create_board (
          board_name: "🧪 Cosmetics Formulas - TEST",
          board_kind: public,
          workspace_id: ${targetWorkspace.id},
          description: "Test board for cosmetics formula data - Generated automatically"
        ) {
          id
          name
        }
      }
    `;
    
    const formulasBoardResponse = await monday.api(formulasBoardMutation);
    const formulasBoard = formulasBoardResponse.data.create_board;
    console.log(`✅ Created formulas board: ${formulasBoard.name} (ID: ${formulasBoard.id})`);
    
    // 2. Create Ingredients/Pricing Board in new workspace
    const pricingBoardMutation = `
      mutation {
        create_board (
          board_name: "💰 Ingredient Pricing - TEST",
          board_kind: public,
          workspace_id: ${targetWorkspace.id},
          description: "Test board for ingredient pricing and usage analysis"
        ) {
          id
          name
        }
      }
    `;
    
    const pricingBoardResponse = await monday.api(pricingBoardMutation);
    const pricingBoard = pricingBoardResponse.data.create_board;
    console.log(`✅ Created pricing board: ${pricingBoard.name} (ID: ${pricingBoard.id})`);
    
    // Update .env with board IDs
    console.log(`\n📝 Updating .env with board IDs...`);
    
    const fs = require('fs');
    let envContent = fs.readFileSync('.env', 'utf8');
    
    // Update or add board IDs
    if (envContent.includes('FORMULAS_BOARD_ID=')) {
      envContent = envContent.replace(/FORMULAS_BOARD_ID=.*/, `FORMULAS_BOARD_ID=${formulasBoard.id}`);
    } else {
      envContent += `\nFORMULAS_BOARD_ID=${formulasBoard.id}`;
    }
    
    if (envContent.includes('PRICING_BOARD_ID=')) {
      envContent = envContent.replace(/PRICING_BOARD_ID=.*/, `PRICING_BOARD_ID=${pricingBoard.id}`);
    } else {
      envContent += `\nPRICING_BOARD_ID=${pricingBoard.id}`;
    }
    
    fs.writeFileSync('.env', envContent);
    
    console.log(`\n🎉 TEST WORKSPACE SETUP COMPLETE!`);
    console.log(`\n📋 Your test boards:`);
    console.log(`  🧪 Formulas: https://monday.com/boards/${formulasBoard.id}`);
    console.log(`  💰 Pricing: https://monday.com/boards/${pricingBoard.id}`);
    
    console.log(`\n🚀 Next steps:`);
    console.log(`  1. npm run sync -- --dry-run (preview data sync)`);
    console.log(`  2. npm run sync (sync formulas to Monday)`);
    console.log(`  3. npm run pricing (create pricing analysis)`);
    
  } catch (error) {
    console.error('❌ Error setting up workspace:', error.message);
    if (error.response?.data) {
      console.error('API Details:', error.response.data);
    }
    
    if (error.message.includes('authentication')) {
      console.log('\n🔑 Authentication issue:');
      console.log('1. Check your API token in .env file');
      console.log('2. Ensure token has read/write permissions');
      console.log('3. Try regenerating the token if needed');
    }
  }
}

setupTestWorkspace();