const { Pool } = require('pg');
require('dotenv').config();

async function processINCIResearch(researchResults) {
  console.log('🔬 PROCESSING INCI RESEARCH RESULTS...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Parse research results - expects markdown format from Claude
    const updates = parseResearchResults(researchResults);
    
    console.log(`📊 Found ${updates.length} ingredient updates\n`);
    
    // Categorize updates
    const newINCI = updates.filter(u => u.status === 'NEW');
    const corrected = updates.filter(u => u.status === 'CORRECTED'); 
    const verified = updates.filter(u => u.status === 'VERIFIED');
    
    console.log(`🆕 New INCI names: ${newINCI.length}`);
    console.log(`🔧 Corrected INCI: ${corrected.length}`);
    console.log(`✅ Verified correct: ${verified.length}\n`);
    
    // Process updates
    let updatedCount = 0;
    let errorCount = 0;
    
    for (const update of updates) {
      try {
        if (update.status === 'NEW' || update.status === 'CORRECTED') {
          console.log(`🔧 ${update.ingredientName}: "${update.inciName}"`);
          
          const updateQuery = `
            UPDATE ingredients 
            SET inci_name = $1 
            WHERE LOWER(TRIM(name)) = LOWER(TRIM($2))
          `;
          
          const result = await pool.query(updateQuery, [
            update.inciName, 
            update.ingredientName
          ]);
          
          if (result.rowCount > 0) {
            updatedCount++;
            console.log(`   ✅ Updated (${update.confidence} confidence)`);
          } else {
            console.log(`   ⚠️  No matching ingredient found in database`);
            errorCount++;
          }
        } else if (update.status === 'VERIFIED') {
          console.log(`✅ ${update.ingredientName}: Verified correct`);
        }
        
      } catch (error) {
        console.error(`   ❌ Error updating ${update.ingredientName}: ${error.message}`);
        errorCount++;
      }
    }
    
    console.log(`\n🎉 PROCESSING COMPLETE!`);
    console.log(`✅ Successfully updated: ${updatedCount} ingredients`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Verified as correct: ${verified.length}`);
    
    // Final statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_ingredients,
        COUNT(CASE WHEN inci_name IS NOT NULL AND inci_name != '' THEN 1 END) as with_inci,
        COUNT(CASE WHEN inci_name IS NULL OR inci_name = '' THEN 1 END) as without_inci
      FROM ingredients
    `;
    
    const statsResult = await pool.query(statsQuery);
    const stats = statsResult.rows[0];
    
    console.log(`\n📊 DATABASE STATISTICS AFTER UPDATE:`);
    console.log(`   Total ingredients: ${stats.total_ingredients}`);
    console.log(`   With INCI names: ${stats.with_inci} (${((stats.with_inci / stats.total_ingredients) * 100).toFixed(1)}%)`);
    console.log(`   Without INCI names: ${stats.without_inci} (${((stats.without_inci / stats.total_ingredients) * 100).toFixed(1)}%)`);
    
    const improvementPercent = ((stats.with_inci / stats.total_ingredients) * 100) - 60.2;
    console.log(`   Improvement: +${improvementPercent.toFixed(1)}% INCI coverage`);
    
    console.log(`\n🚀 AUTOMATIC MONDAY UPLOAD:`);
    console.log(`Starting automatic sync to Monday.com...`);
    
    // Automatically trigger Monday sync
    const { syncINCIToMonday } = require('./sync-inci-to-monday');
    await syncINCIToMonday();
    
    console.log(`\n💡 NEXT STEPS:`);
    console.log(`1. Run enhanced INCI automation: node enhanced-inci-automation.js`);
    console.log(`2. Add regulatory columns: node add-inci-board-columns.js`);
    console.log(`3. Check formula mirror columns for INCI data appearance`);
    console.log(`4. Review any remaining ingredients without INCI names`);
    
  } catch (error) {
    console.error('❌ Error processing INCI research:', error.message);
  } finally {
    await pool.end();
  }
}

function parseResearchResults(researchText) {
  const updates = [];
  
  // Split by ingredient blocks (markdown format expected from Claude)
  const blocks = researchText.split(/\*\*([^*]+)\*\*/g);
  
  for (let i = 1; i < blocks.length; i += 2) {
    const ingredientName = blocks[i].trim();
    const content = blocks[i + 1];
    
    if (!content) continue;
    
    // Extract INCI name
    const inciMatch = content.match(/INCI Name[:\s]*([^\n]+)/i);
    if (!inciMatch) continue;
    
    const inciName = inciMatch[1].trim();
    
    // Extract confidence
    const confidenceMatch = content.match(/Confidence[:\s]*([^\n]+)/i);
    const confidence = confidenceMatch ? confidenceMatch[1].trim() : 'Unknown';
    
    // Extract status
    const statusMatch = content.match(/Status[:\s]*([^\n]+)/i);
    const status = statusMatch ? statusMatch[1].trim() : 'NEW';
    
    // Extract source
    const sourceMatch = content.match(/Source[:\s]*([^\n]+)/i);
    const source = sourceMatch ? sourceMatch[1].trim() : 'Claude Research';
    
    // Extract notes
    const notesMatch = content.match(/Notes[:\s]*([^\n]+)/i);
    const notes = notesMatch ? notesMatch[1].trim() : '';
    
    updates.push({
      ingredientName,
      inciName,
      confidence,
      status,
      source,
      notes
    });
  }
  
  return updates;
}

// Example usage and testing
function testParser() {
  const sampleText = `
**Citric acid 50% solution (see below) pH to 4.8-5.2**
- **INCI Name**: Citric Acid
- **Confidence**: High
- **Source**: Personal Care Products Council INCI Dictionary
- **Notes**: The 50% solution concentration doesn't change the INCI name - it's still just Citric Acid
- **Status**: NEW

**Glyceryl Stearate**
- **INCI Name**: Glyceryl Stearate
- **Confidence**: High
- **Source**: CosIng Database
- **Notes**: Standard emulsifier INCI name is correct
- **Status**: NEW
  `;
  
  const results = parseResearchResults(sampleText);
  console.log('🧪 TEST RESULTS:');
  console.log(JSON.stringify(results, null, 2));
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args[0] === '--test') {
    testParser();
  } else if (args[0] === '--file') {
    const fs = require('fs');
    const filePath = args[1];
    
    if (!filePath) {
      console.log('Usage: node process-inci-research.js --file <path-to-research-results.md>');
      process.exit(1);
    }
    
    try {
      const researchText = fs.readFileSync(filePath, 'utf8');
      processINCIResearch(researchText);
    } catch (error) {
      console.error('❌ Error reading file:', error.message);
    }
  } else {
    console.log(`
🔬 INCI Research Processor

Usage:
  node process-inci-research.js --file <research-results.md>
  node process-inci-research.js --test

Description:
  Processes Claude's INCI research results and updates the database.
  
Expected format from Claude research:
  **[Ingredient Name]**
  - **INCI Name**: [Correct INCI]
  - **Confidence**: High/Medium/Low
  - **Source**: [Research source]
  - **Notes**: [Any notes]
  - **Status**: NEW/VERIFIED/CORRECTED

Examples:
  # After getting research results from Claude:
  node process-inci-research.js --file claude-inci-results.md
  
  # Test the parser:
  node process-inci-research.js --test
    `);
  }
}

module.exports = { processINCIResearch, parseResearchResults };