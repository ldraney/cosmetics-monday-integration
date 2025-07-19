const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();

async function debugMondayAPI() {
  console.log('🔧 DEBUGGING MONDAY.COM API CONNECTION');
  console.log('=====================================\n');
  
  try {
    // Check API token
    const token = process.env.MONDAY_API_TOKEN;
    if (!token) {
      console.log('❌ No MONDAY_API_TOKEN found in environment');
      return;
    }
    
    console.log(`🔑 API Token: ${token.substring(0, 10)}... (${token.length} chars)`);
    monday.setToken(token);
    
    // Test 1: Basic API connectivity
    console.log('\\n🧪 Test 1: Basic API connectivity...');
    try {
      const meQuery = `query { me { id name email } }`;
      const meResponse = await monday.api(meQuery);
      
      if (meResponse.data && meResponse.data.me) {
        console.log(`✅ Connected as: ${meResponse.data.me.name} (${meResponse.data.me.email})`);
      } else {
        console.log('❌ API responded but no user data:', meResponse);
      }
    } catch (error) {
      console.log('❌ Basic connectivity failed:', error.message);
      if (error.response) {
        console.log('Response data:', error.response.data);
      }
      return;
    }
    
    // Test 2: List all boards
    console.log('\\n🧪 Test 2: List all accessible boards...');
    try {
      const allBoardsQuery = `query { boards(limit: 50) { id name } }`;
      const allBoardsResponse = await monday.api(allBoardsQuery);
      
      if (allBoardsResponse.data && allBoardsResponse.data.boards) {
        const boards = allBoardsResponse.data.boards;
        console.log(`✅ Found ${boards.length} accessible boards:`);
        boards.forEach(board => {
          console.log(`  • ${board.name} (ID: ${board.id})`);
        });
      } else {
        console.log('❌ No boards data in response:', allBoardsResponse);
      }
    } catch (error) {
      console.log('❌ List boards failed:', error.message);
      return;
    }
    
    // Test 3: Check specific board IDs
    console.log('\\n🧪 Test 3: Check our specific board IDs...');
    const ourBoardIds = [
      { name: 'INCI', id: process.env.INCI_BOARD_ID },
      { name: 'Ingredients', id: process.env.INGREDIENTS_BOARD_ID },
      { name: 'Formulas', id: process.env.FORMULAS_BOARD_ID },
      { name: 'Pricing', id: process.env.PRICING_BOARD_ID }
    ];
    
    for (const board of ourBoardIds) {
      if (!board.id) {
        console.log(`⚠️  ${board.name}: No ID configured`);
        continue;
      }
      
      try {
        const boardQuery = `query { boards(ids: [${board.id}]) { id name state } }`;
        const boardResponse = await monday.api(boardQuery);
        
        if (boardResponse.data && boardResponse.data.boards && boardResponse.data.boards.length > 0) {
          const foundBoard = boardResponse.data.boards[0];
          console.log(`✅ ${board.name}: ${foundBoard.name} (${foundBoard.state})`);
        } else {
          console.log(`❌ ${board.name}: Board ID ${board.id} not found or not accessible`);
        }
      } catch (error) {
        console.log(`❌ ${board.name}: Error checking board - ${error.message}`);
      }
      
      // Small delay to avoid rate limits
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Test 4: Check workspace access
    console.log('\\n🧪 Test 4: Check workspace access...');
    try {
      const workspaceQuery = `query { boards(limit: 10) { id name workspace { id name } } }`;
      const workspaceResponse = await monday.api(workspaceQuery);
      
      if (workspaceResponse.data && workspaceResponse.data.boards) {
        const workspaces = [...new Set(workspaceResponse.data.boards
          .filter(b => b.workspace)
          .map(b => `${b.workspace.name} (ID: ${b.workspace.id})`)
        )];
        
        console.log(`✅ Accessible workspaces:`);
        workspaces.forEach(ws => console.log(`  • ${ws}`));
        
        // Check if our boards are in the expected workspace
        const testLabBoards = workspaceResponse.data.boards.filter(b => 
          b.workspace && b.workspace.name.includes('Testing Lab')
        );
        console.log(`📍 Boards in "Cosmetics Testing Lab": ${testLabBoards.length}`);
        testLabBoards.forEach(b => console.log(`  • ${b.name} (ID: ${b.id})`));
      }
    } catch (error) {
      console.log('❌ Workspace check failed:', error.message);
    }
    
    console.log('\\n🎯 DIAGNOSIS COMPLETE');
    console.log('=====================');
    
  } catch (error) {
    console.error('❌ Debug failed:', error.message);
    if (error.response) {
      console.error('Full error response:', JSON.stringify(error.response.data, null, 2));
    }
  }
}

debugMondayAPI();