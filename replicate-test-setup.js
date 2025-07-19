const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();

/**
 * Replicates the exact setup from the TEST board configuration
 * 
 * Current TEST Setup Analysis:
 * - Formulas Board (9625728737) connects to Ingredients Board (9625733140)
 * - Ingredients Board connects to INCI Board (9625740593) 
 * - Formulas Board has mirror column showing INCI names from connected ingredients
 * 
 * Connection Flow: Formulas → Ingredients → INCI (with mirror back to show INCI names)
 */

async function replicateTestSetup(options = {}) {
  console.log('🔧 REPLICATING TEST BOARD SETUP');
  console.log('===============================\n');
  
  if (!process.env.MONDAY_API_TOKEN || process.env.MONDAY_API_TOKEN === 'your_monday_api_token_here') {
    console.error('❌ Please set your actual MONDAY_API_TOKEN in the .env file');
    return;
  }
  
  monday.setToken(process.env.MONDAY_API_TOKEN);
  
  const config = {
    dryRun: options.dryRun || false,
    workspace: options.workspace || 'Cosmetics Testing Lab',
    // Use existing boards by default, or create new ones if specified
    useExistingBoards: options.useExistingBoards !== false,
    ...options
  };
  
  console.log(`🎯 Configuration:`);
  console.log(`   Dry Run: ${config.dryRun}`);
  console.log(`   Use Existing Boards: ${config.useExistingBoards}`);
  console.log(`   Target Workspace: ${config.workspace}\n`);
  
  try {
    let formulasBoardId, ingredientsBoardId, inciBoardId;
    
    if (config.useExistingBoards) {
      // Use the existing TEST boards
      formulasBoardId = '9625728737';
      ingredientsBoardId = '9625733140'; 
      inciBoardId = '9625740593';
      
      console.log('✅ Using existing boards:');
      console.log(`   • Formulas: ${formulasBoardId}`);
      console.log(`   • Ingredients: ${ingredientsBoardId}`);
      console.log(`   • INCI: ${inciBoardId}\n`);
    } else {
      // Create new boards (implementation for this would go here)
      throw new Error('Creating new boards not implemented yet - use existing boards');
    }
    
    // Step 1: Verify all boards exist and are accessible
    console.log('🔍 STEP 1: Verifying board access...');
    
    const verifyQuery = `
      query {
        boards(ids: [${formulasBoardId}, ${ingredientsBoardId}, ${inciBoardId}]) {
          id
          name
          state
          columns {
            id
            title
            type
          }
        }
      }
    `;
    
    const verifyResponse = await monday.api(verifyQuery);
    const boards = verifyResponse.data.boards;
    
    if (boards.length !== 3) {
      throw new Error(`Expected 3 boards, found ${boards.length}`);
    }
    
    const formulasBoard = boards.find(b => b.id === formulasBoardId);
    const ingredientsBoard = boards.find(b => b.id === ingredientsBoardId);
    const inciBoard = boards.find(b => b.id === inciBoardId);
    
    console.log(`✅ All boards accessible:`);
    console.log(`   • ${formulasBoard.name} (${formulasBoard.state})`);
    console.log(`   • ${ingredientsBoard.name} (${ingredientsBoard.state})`);
    console.log(`   • ${inciBoard.name} (${inciBoard.state})\n`);
    
    // Step 2: Check for required connection columns
    console.log('🔍 STEP 2: Checking connection columns...');
    
    // Check if formulas board has connection to ingredients
    const formulasToIngredientsConnection = formulasBoard.columns.find(col => 
      col.type === 'board_relation' && 
      col.title.toLowerCase().includes('ingredient')
    );
    
    // Check if ingredients board has connection to INCI
    const ingredientsToInciConnection = ingredientsBoard.columns.find(col =>
      col.type === 'board_relation' && 
      col.title.toLowerCase().includes('inci')
    );
    
    // Check if formulas board has INCI mirror column
    const inciMirrorColumn = formulasBoard.columns.find(col =>
      col.type === 'mirror' &&
      col.title.toLowerCase().includes('inci')
    );
    
    console.log(`🔗 Connection Analysis:`);
    console.log(`   Formulas → Ingredients: ${formulasToIngredientsConnection ? '✅ Exists' : '❌ Missing'}`);
    console.log(`   Ingredients → INCI: ${ingredientsToInciConnection ? '✅ Exists' : '❌ Missing'}`);
    console.log(`   INCI Mirror on Formulas: ${inciMirrorColumn ? '✅ Exists' : '❌ Missing'}\n`);
    
    // Step 3: Create missing connection columns
    console.log('🔧 STEP 3: Creating missing connection columns...');
    
    if (!formulasToIngredientsConnection) {
      console.log('📝 Creating Formulas → Ingredients connection...');
      
      if (!config.dryRun) {
        const createConnectionQuery = `
          mutation {
            create_column(
              board_id: ${formulasBoardId}
              title: "🧪 Ingredients Master Database"
              column_type: board_relation
              defaults: "{\\"boardIds\\":[${ingredientsBoardId}]}"
            ) {
              id
              title
            }
          }
        `;
        
        const connectionResult = await monday.api(createConnectionQuery);
        console.log(`   ✅ Created: ${connectionResult.data.create_column.title} (${connectionResult.data.create_column.id})`);
      } else {
        console.log('   🔍 [DRY RUN] Would create Formulas → Ingredients connection');
      }
    } else {
      console.log(`   ✅ Connection already exists: ${formulasToIngredientsConnection.title}`);
    }
    
    if (!ingredientsToInciConnection) {
      console.log('📝 Creating Ingredients → INCI connection...');
      
      if (!config.dryRun) {
        const createInciConnectionQuery = `
          mutation {
            create_column(
              board_id: ${ingredientsBoardId}
              title: "🧬 INCI Master Database"
              column_type: board_relation
              defaults: "{\\"boardIds\\":[${inciBoardId}]}"
            ) {
              id
              title
            }
          }
        `;
        
        const inciConnectionResult = await monday.api(createInciConnectionQuery);
        console.log(`   ✅ Created: ${inciConnectionResult.data.create_column.title} (${inciConnectionResult.data.create_column.id})`);
      } else {
        console.log('   🔍 [DRY RUN] Would create Ingredients → INCI connection');
      }
    } else {
      console.log(`   ✅ Connection already exists: ${ingredientsToInciConnection.title}`);
    }
    
    // Step 4: Create INCI mirror column on formulas board
    if (!inciMirrorColumn) {
      console.log('🪞 Creating INCI Names mirror column on Formulas board...');
      
      // First, we need the connection column ID and the INCI column ID to mirror
      const updatedFormulasBoard = await monday.api(`
        query {
          boards(ids: [${formulasBoardId}]) {
            columns {
              id
              title
              type
            }
          }
        }
      `);
      
      const currentConnection = updatedFormulasBoard.data.boards[0].columns.find(col =>
        col.type === 'board_relation' && col.title.toLowerCase().includes('ingredient')
      );
      
      if (currentConnection) {
        // Get the INCI board structure to find the name column or INCI name column
        const inciStructure = await monday.api(`
          query {
            boards(ids: [${inciBoardId}]) {
              columns {
                id
                title
                type
              }
            }
          }
        `);
        
        // Use the name column as the mirror source (or find a specific INCI column)
        const nameColumn = inciStructure.data.boards[0].columns.find(col => col.type === 'name');
        const inciNameColumn = inciStructure.data.boards[0].columns.find(col => 
          col.title.toLowerCase().includes('inci') && col.type === 'text'
        ) || nameColumn;
        
        if (!config.dryRun) {
          const createMirrorQuery = `
            mutation {
              create_column(
                board_id: ${formulasBoardId}
                title: "INCI Names"
                column_type: mirror
                defaults: "{\\"mirrorBoardId\\":${inciBoardId},\\"mirrorColumnId\\":\\"${inciNameColumn.id}\\",\\"dependencyColumnId\\":\\"${currentConnection.id}\\"}"
              ) {
                id
                title
              }
            }
          `;
          
          const mirrorResult = await monday.api(createMirrorQuery);
          console.log(`   ✅ Created mirror column: ${mirrorResult.data.create_column.title} (${mirrorResult.data.create_column.id})`);
        } else {
          console.log('   🔍 [DRY RUN] Would create INCI Names mirror column');
          console.log(`       Mirror source: ${inciNameColumn.title} from INCI board`);
          console.log(`       Via connection: ${currentConnection.title}`);
        }
      } else {
        console.log('   ❌ Cannot create mirror column - no ingredients connection found');
      }
    } else {
      console.log(`   ✅ Mirror column already exists: ${inciMirrorColumn.title}`);
    }
    
    console.log('\\n🎉 SETUP REPLICATION COMPLETE!');
    console.log('================================');
    console.log('✅ Board connections verified/created');
    console.log('✅ Mirror column configured');
    console.log('\\n📋 Your setup now matches the TEST board configuration:');
    console.log('   1. Formulas connect to Ingredients via dependency column');
    console.log('   2. Ingredients connect to INCI via dependency column');  
    console.log('   3. Formulas display INCI names via mirror column');
    console.log('\\n💡 Next steps:');
    console.log('   • Use sync scripts to populate the boards with data');
    console.log('   • Connect specific formula items to their ingredients');
    console.log('   • Verify INCI names appear automatically in mirror column');
    
    return {
      formulasBoardId,
      ingredientsBoardId,
      inciBoardId,
      success: true
    };
    
  } catch (error) {
    console.error('❌ Setup replication failed:', error.message);
    if (error.response?.data) {
      console.error('API Response:', JSON.stringify(error.response.data, null, 2));
    }
    return { success: false, error: error.message };
  }
}

// Command line usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  if (args.includes('--dry-run')) {
    options.dryRun = true;
  }
  
  if (args.includes('--new-boards')) {
    options.useExistingBoards = false;
  }
  
  const workspaceArg = args.find(arg => arg.startsWith('--workspace='));
  if (workspaceArg) {
    options.workspace = workspaceArg.split('=')[1];
  }
  
  replicateTestSetup(options);
}

module.exports = { replicateTestSetup };