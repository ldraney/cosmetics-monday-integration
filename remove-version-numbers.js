const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function removeVersionNumbers() {
  console.log('🔧 REMOVING v1.0 FROM FORMULA NAMES...\n');
  
  try {
    const formulasBoardId = '9625728737'; // Formulas board
    
    // Get all formulas
    console.log('📋 Getting current formula names...');
    
    const formulasQuery = `
      query {
        boards(ids: [${formulasBoardId}]) {
          name
          items_page(limit: 100) {
            items {
              id
              name
            }
          }
        }
      }
    `;
    
    const response = await monday.api(formulasQuery);
    const board = response.data?.boards?.[0];
    const formulas = board?.items_page?.items || [];
    
    console.log(`✅ Found ${formulas.length} formulas on Monday\n`);
    
    // Find formulas with v1.0 in the name
    const formulasToUpdate = formulas.filter(formula => 
      formula.name.includes(' v1.0') || formula.name.includes(' V1.0')
    );
    
    console.log(`🔧 Found ${formulasToUpdate.length} formulas with version numbers to remove:\n`);
    
    if (formulasToUpdate.length === 0) {
      console.log('✅ No formulas found with v1.0 in the name');
      return;
    }
    
    let updatedCount = 0;
    
    for (const formula of formulasToUpdate) {
      const currentName = formula.name;
      const newName = currentName
        .replace(/ v1\.0/g, '')
        .replace(/ V1\.0/g, '')
        .trim();
      
      console.log(`🔧 "${currentName}" → "${newName}"`);
      
      try {
        const updateMutation = `
          mutation {
            change_column_value(
              board_id: ${formulasBoardId},
              item_id: ${formula.id},
              column_id: "name",
              value: "{\\"text\\": \\"${newName.replace(/"/g, '\\"')}\\"}"
            ) {
              id
            }
          }
        `;
        
        const updateResponse = await monday.api(updateMutation);
        
        if (updateResponse.data?.change_column_value?.id) {
          updatedCount++;
          console.log(`   ✅ Updated successfully`);
        } else {
          console.log(`   ❌ Update failed`);
        }
        
        // Rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`   ❌ Error updating ${currentName}: ${error.message}`);
      }
    }
    
    console.log(`\n🎉 VERSION CLEANUP COMPLETE!`);
    console.log(`✅ Updated ${updatedCount}/${formulasToUpdate.length} formula names`);
    
    // Show final result
    console.log('\n📋 Updated formulas:');
    for (const formula of formulasToUpdate.slice(0, 10)) {
      const cleanName = formula.name
        .replace(/ v1\.0/g, '')
        .replace(/ V1\.0/g, '')
        .trim();
      console.log(`   • ${cleanName}`);
    }
    
    if (formulasToUpdate.length > 10) {
      console.log(`   ... and ${formulasToUpdate.length - 10} more`);
    }
    
  } catch (error) {
    console.error('❌ Error removing version numbers:', error.message);
  }
}

removeVersionNumbers();