const mondaySDK = require('monday-sdk-js');
const { Pool } = require('pg');
require('dotenv').config();

const monday = mondaySDK();

async function createInciBoard() {
  console.log('🧬 Creating INCI Master Board...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    if (!process.env.MONDAY_API_TOKEN) {
      console.error('❌ MONDAY_API_TOKEN environment variable required');
      return;
    }
    
    monday.setToken(process.env.MONDAY_API_TOKEN);
    
    // Get unique INCI names from database
    console.log('📊 Extracting unique INCI names from database...');
    
    const inciQuery = `
      SELECT 
        DISTINCT TRIM(inci_name) as inci_name,
        COUNT(DISTINCT i.id) as ingredient_count,
        ARRAY_AGG(DISTINCT i.name ORDER BY i.name) as used_in_ingredients
      FROM ingredients i
      WHERE inci_name IS NOT NULL 
        AND TRIM(inci_name) != ''
        AND TRIM(inci_name) != 'No INCI available'
      GROUP BY TRIM(inci_name)
      HAVING COUNT(DISTINCT i.id) > 0
      ORDER BY COUNT(DISTINCT i.id) DESC, TRIM(inci_name)
    `;
    
    const result = await pool.query(inciQuery);
    console.log(`✅ Found ${result.rows.length} unique INCI names`);
    
    // Also get INCI names from the Excel mappings if available
    console.log('📊 Checking for additional INCI data from Excel...');
    
    const fs = require('fs');
    let additionalIncis = [];
    
    try {
      // Check if we have the INCI mappings from earlier extraction
      const inciMappingsPath = '../cosmetics-data-hub-v2-standalone/inci-mappings.json';
      if (fs.existsSync(inciMappingsPath)) {
        const inciMappings = JSON.parse(fs.readFileSync(inciMappingsPath, 'utf8'));
        
        // Extract unique INCI names from mappings
        const excelIncis = [...new Set(inciMappings.map(m => m.inci_name.trim()))]
          .filter(inci => inci && inci !== '' && !result.rows.find(r => r.inci_name === inci))
          .map(inci => ({
            inci_name: inci,
            ingredient_count: 0,
            used_in_ingredients: ['From Excel - Not yet in database']
          }));
        
        additionalIncis = excelIncis;
        console.log(`✅ Found ${additionalIncis.length} additional INCI names from Excel`);
      }
    } catch (error) {
      console.log('⚠️  Could not load additional INCI data from Excel mappings');
    }
    
    const allIncis = [...result.rows, ...additionalIncis];
    console.log(`📊 Total INCI names to add: ${allIncis.length}`);
    
    // Create INCI board in the test workspace
    console.log('🆕 Creating INCI Master board...');
    
    const createBoardMutation = `
      mutation {
        create_board (
          board_name: "🧬 INCI Master Database",
          board_kind: public,
          workspace_id: 11691826,
          description: "Master list of all INCI (International Nomenclature of Cosmetic Ingredients) names with regulatory and safety information"
        ) {
          id
          name
        }
      }
    `;
    
    const boardResponse = await monday.api(createBoardMutation);
    const inciBoard = boardResponse.data.create_board;
    console.log(`✅ Created INCI board: ${inciBoard.name} (ID: ${inciBoard.id})`);
    
    // Add INCI names to the board in small batches (respecting rate limits)
    console.log('🔄 Adding INCI names to Monday board (respecting rate limits)...');
    
    let addedCount = 0;
    const batchSize = 8; // Very small batches for rate limiting
    const totalIncis = allIncis.length;
    
    for (let i = 0; i < totalIncis; i += batchSize) {
      const batch = allIncis.slice(i, i + batchSize);
      
      for (const inci of batch) {
        try {
          const inciName = inci.inci_name;
          const ingredientCount = inci.ingredient_count;
          const usedInIngredients = inci.used_in_ingredients.slice(0, 3).join(', ') + 
                                   (inci.used_in_ingredients.length > 3 ? '...' : '');
          
          // Determine status based on usage
          let status = 'Active';
          if (ingredientCount === 0) status = 'Reference Only';
          else if (ingredientCount >= 5) status = 'High Usage';
          else if (ingredientCount >= 2) status = 'Medium Usage';
          
          // Estimate regulatory category (simplified)
          let category = 'General';
          const lowerInci = inciName.toLowerCase();
          if (lowerInci.includes('aqua') || lowerInci.includes('water')) category = 'Solvent';
          else if (lowerInci.includes('oil') || lowerInci.includes('butter')) category = 'Emollient';
          else if (lowerInci.includes('extract')) category = 'Active';
          else if (lowerInci.includes('acid')) category = 'Active/pH Adjuster';
          else if (lowerInci.includes('alcohol')) category = 'Emulsifier/Solvent';
          
          const itemName = inciName.length > 60 
            ? inciName.substring(0, 57) + '...' 
            : inciName;
          
          const itemMutation = `
            mutation {
              create_item (
                board_id: ${inciBoard.id},
                item_name: "${itemName.replace(/"/g, '\\"')}",
                column_values: "{\\"text\\": \\"${category.replace(/"/g, '\\"')}\\", \\"numbers\\": \\"${ingredientCount}\\", \\"status\\": \\"${status}\\", \\"long_text\\": \\"Used in ingredients: ${usedInIngredients.replace(/"/g, '\\"')}\\"}"
              ) {
                id
                name
              }
            }
          `;
          
          await monday.api(itemMutation);
          addedCount++;
          
        } catch (error) {
          console.error(`❌ Error adding INCI ${inci.inci_name}:`, error.message);
        }
      }
      
      console.log(`  ✅ Added ${Math.min(addedCount, totalIncis)} / ${totalIncis} INCI names...`);
      
      // Longer delay for rate limiting (Monday.com allows ~10 requests/second)
      if (i + batchSize < totalIncis) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      }
    }
    
    // Update .env with INCI board ID
    console.log('📝 Updating .env with INCI board ID...');
    let envContent = fs.readFileSync('.env', 'utf8');
    
    if (envContent.includes('INCI_BOARD_ID=')) {
      envContent = envContent.replace(/INCI_BOARD_ID=.*/, `INCI_BOARD_ID=${inciBoard.id}`);
    } else {
      envContent += `\nINCI_BOARD_ID=${inciBoard.id}`;
    }
    
    fs.writeFileSync('.env', envContent);
    
    console.log(`\n🎉 INCI BOARD COMPLETE!`);
    console.log(`📊 Added ${addedCount} INCI names`);
    console.log(`🔗 View board: https://monday.com/boards/${inciBoard.id}`);
    
    // Summary statistics
    const activeCount = allIncis.filter(inci => inci.ingredient_count > 0).length;
    const referenceCount = allIncis.filter(inci => inci.ingredient_count === 0).length;
    const highUsageCount = allIncis.filter(inci => inci.ingredient_count >= 5).length;
    
    console.log(`\n📈 INCI Summary:`);
    console.log(`  • Active INCI names: ${activeCount}`);
    console.log(`  • Reference only: ${referenceCount}`);
    console.log(`  • High usage (5+ ingredients): ${highUsageCount}`);
    
    console.log(`\n🔗 Next: Create connections between boards`);
    console.log(`  1. Ingredients → INCI relationships`);
    console.log(`  2. Formulas → Ingredients relationships`);
    console.log(`  3. Add pricing calculations`);
    
    return inciBoard.id;
    
  } catch (error) {
    console.error('❌ Error creating INCI board:', error.message);
    if (error.response?.data) {
      console.error('API Response:', error.response.data);
    }
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  createInciBoard();
}

module.exports = { createInciBoard };