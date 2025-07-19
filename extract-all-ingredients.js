const { Pool } = require('pg');
require('dotenv').config();

async function extractAllIngredients() {
  console.log('📋 EXTRACTING COMPLETE INGREDIENT LIST FOR INCI RESEARCH...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Get all ingredients with their usage stats and current INCI status
    const ingredientsQuery = `
      SELECT 
        i.id,
        i.name,
        i.category,
        i.inci_name,
        COUNT(fi.formula_id) as used_in_formulas,
        ROUND(AVG(fi.percentage)::numeric, 3) as avg_percentage,
        ROUND(MIN(fi.percentage)::numeric, 3) as min_percentage,
        ROUND(MAX(fi.percentage)::numeric, 3) as max_percentage,
        json_agg(DISTINCT f.name ORDER BY f.name) as formula_names
      FROM ingredients i
      LEFT JOIN formula_ingredients fi ON i.id = fi.ingredient_id
      LEFT JOIN formulas f ON fi.formula_id = f.id
      GROUP BY i.id, i.name, i.category, i.inci_name
      ORDER BY COUNT(fi.formula_id) DESC, i.name
    `;
    
    const result = await pool.query(ingredientsQuery);
    
    console.log(`✅ Found ${result.rows.length} total ingredients in database\n`);
    
    // Categorize ingredients
    const withINCI = result.rows.filter(ing => ing.inci_name && ing.inci_name.trim() !== '');
    const withoutINCI = result.rows.filter(ing => !ing.inci_name || ing.inci_name.trim() === '');
    const used = result.rows.filter(ing => ing.used_in_formulas > 0);
    const unused = result.rows.filter(ing => ing.used_in_formulas === 0);
    
    console.log('📊 INGREDIENT ANALYSIS:');
    console.log('=======================');
    console.log(`Total ingredients: ${result.rows.length}`);
    console.log(`With INCI names: ${withINCI.length} (${((withINCI.length / result.rows.length) * 100).toFixed(1)}%)`);
    console.log(`Without INCI names: ${withoutINCI.length} (${((withoutINCI.length / result.rows.length) * 100).toFixed(1)}%)`);
    console.log(`Used in formulas: ${used.length}`);
    console.log(`Unused: ${unused.length}\n`);
    
    // Create the research list
    console.log('🔬 CREATING INCI RESEARCH LIST...\n');
    
    const researchList = [];
    
    // Priority 1: High-usage ingredients without INCI
    const highUsageNoINCI = withoutINCI.filter(ing => ing.used_in_formulas >= 5);
    
    // Priority 2: Medium-usage ingredients without INCI
    const mediumUsageNoINCI = withoutINCI.filter(ing => ing.used_in_formulas >= 2 && ing.used_in_formulas < 5);
    
    // Priority 3: Low-usage ingredients without INCI
    const lowUsageNoINCI = withoutINCI.filter(ing => ing.used_in_formulas >= 1 && ing.used_in_formulas < 2);
    
    // Priority 4: Unused ingredients without INCI
    const unusedNoINCI = withoutINCI.filter(ing => ing.used_in_formulas === 0);
    
    // Priority 5: Ingredients with INCI that need verification
    const needVerification = withINCI.filter(ing => ing.used_in_formulas >= 2);
    
    console.log(`🔴 HIGH PRIORITY (5+ formulas, no INCI): ${highUsageNoINCI.length}`);
    console.log(`🟡 MEDIUM PRIORITY (2-4 formulas, no INCI): ${mediumUsageNoINCI.length}`);
    console.log(`🟢 LOW PRIORITY (1 formula, no INCI): ${lowUsageNoINCI.length}`);
    console.log(`⚪ UNUSED (0 formulas, no INCI): ${unusedNoINCI.length}`);
    console.log(`🔍 VERIFICATION NEEDED (have INCI, 2+ formulas): ${needVerification.length}\n`);
    
    // Generate the formatted list for Claude research
    let claudeResearchText = `# COSMETICS INGREDIENT INCI RESEARCH REQUEST\n\n`;
    claudeResearchText += `Please research the correct INCI names for the following ${result.rows.length} cosmetic ingredients. `;
    claudeResearchText += `I need accurate INCI (International Nomenclature of Cosmetic Ingredients) names for regulatory compliance.\n\n`;
    claudeResearchText += `## PRIORITY LEVELS:\n`;
    claudeResearchText += `🔴 **HIGH PRIORITY** = Used in 5+ formulas, needs INCI\n`;
    claudeResearchText += `🟡 **MEDIUM PRIORITY** = Used in 2-4 formulas, needs INCI\n`;
    claudeResearchText += `🟢 **LOW PRIORITY** = Used in 1 formula, needs INCI\n`;
    claudeResearchText += `🔍 **VERIFICATION** = Already has INCI, please verify accuracy\n`;
    claudeResearchText += `⚪ **UNUSED** = Not currently used in formulas\n\n`;
    
    // Add high priority ingredients
    if (highUsageNoINCI.length > 0) {
      claudeResearchText += `## 🔴 HIGH PRIORITY INGREDIENTS (${highUsageNoINCI.length})\n`;
      claudeResearchText += `*These are used in 5+ formulas and desperately need INCI names*\n\n`;
      
      highUsageNoINCI.forEach(ing => {
        claudeResearchText += `**${ing.name}**\n`;
        claudeResearchText += `- Used in: ${ing.used_in_formulas} formulas\n`;
        claudeResearchText += `- Usage range: ${ing.min_percentage}% - ${ing.max_percentage}%\n`;
        if (ing.category) claudeResearchText += `- Category: ${ing.category}\n`;
        claudeResearchText += `- Current INCI: MISSING ❌\n\n`;
      });
    }
    
    // Add medium priority ingredients
    if (mediumUsageNoINCI.length > 0) {
      claudeResearchText += `## 🟡 MEDIUM PRIORITY INGREDIENTS (${mediumUsageNoINCI.length})\n\n`;
      
      mediumUsageNoINCI.forEach(ing => {
        claudeResearchText += `**${ing.name}** (${ing.used_in_formulas} formulas, ${ing.min_percentage}%-${ing.max_percentage}%)\n`;
      });
      claudeResearchText += `\n`;
    }
    
    // Add verification needed ingredients (sample)
    if (needVerification.length > 0) {
      claudeResearchText += `## 🔍 VERIFICATION NEEDED (${needVerification.length} total)\n`;
      claudeResearchText += `*These already have INCI names - please verify they are correct*\n\n`;
      
      needVerification.slice(0, 20).forEach(ing => {
        claudeResearchText += `**${ing.name}**\n`;
        claudeResearchText += `- Current INCI: ${ing.inci_name}\n`;
        claudeResearchText += `- Used in: ${ing.used_in_formulas} formulas\n\n`;
      });
      
      if (needVerification.length > 20) {
        claudeResearchText += `*... and ${needVerification.length - 20} more for verification*\n\n`;
      }
    }
    
    // Add complete ingredient list
    claudeResearchText += `## 📋 COMPLETE INGREDIENT LIST (${result.rows.length} total)\n\n`;
    claudeResearchText += `| Ingredient Name | Current INCI | Used In | Usage % | Priority |\n`;
    claudeResearchText += `|----------------|-------------|---------|---------|----------|\n`;
    
    result.rows.forEach(ing => {
      const priority = ing.used_in_formulas >= 5 ? '🔴 HIGH' :
                      ing.used_in_formulas >= 2 ? '🟡 MED' :
                      ing.used_in_formulas >= 1 ? '🟢 LOW' : '⚪ UNUSED';
      
      const inciStatus = ing.inci_name && ing.inci_name.trim() !== '' ? 
                        (ing.used_in_formulas >= 2 ? '🔍 VERIFY' : '✅ HAS') : 
                        '❌ MISSING';
      
      const usageRange = ing.used_in_formulas > 0 ? 
                        `${ing.min_percentage}%-${ing.max_percentage}%` : 
                        'N/A';
      
      claudeResearchText += `| ${ing.name} | ${ing.inci_name || 'MISSING'} | ${ing.used_in_formulas} | ${usageRange} | ${priority} ${inciStatus} |\n`;
    });
    
    claudeResearchText += `\n## 📝 RESEARCH INSTRUCTIONS\n\n`;
    claudeResearchText += `1. **Focus on HIGH PRIORITY first** - these are blocking formula compliance\n`;
    claudeResearchText += `2. **Verify existing INCI names** - some may be incorrect or outdated\n`;
    claudeResearchText += `3. **Use official INCI sources** like:\n`;
    claudeResearchText += `   - Personal Care Products Council INCI Dictionary\n`;
    claudeResearchText += `   - CosIng (EU Cosmetic Ingredients Database)\n`;
    claudeResearchText += `   - Supplier technical data sheets\n`;
    claudeResearchText += `4. **Handle trade names** - convert proprietary names to INCI\n`;
    claudeResearchText += `5. **Note alternatives** - if multiple INCI names exist\n\n`;
    claudeResearchText += `## 🎯 EXPECTED OUTPUT\n\n`;
    claudeResearchText += `Please provide a structured response with:\n`;
    claudeResearchText += `- Ingredient name\n`;
    claudeResearchText += `- Correct INCI name\n`;
    claudeResearchText += `- Confidence level (High/Medium/Low)\n`;
    claudeResearchText += `- Source/reasoning\n`;
    claudeResearchText += `- Any notes or alternatives\n\n`;
    claudeResearchText += `**Total ingredients to research: ${result.rows.length}**\n`;
    claudeResearchText += `**High priority: ${highUsageNoINCI.length}**\n`;
    claudeResearchText += `**Medium priority: ${mediumUsageNoINCI.length}**\n`;
    claudeResearchText += `**Verification needed: ${needVerification.length}**\n`;
    
    // Save to file
    const fs = require('fs');
    const filename = `/Users/earthharbor/projects/project-pel-lab/cosmetics-monday-integration/INCI_RESEARCH_LIST.md`;
    fs.writeFileSync(filename, claudeResearchText);
    
    console.log(`📄 RESEARCH LIST CREATED!`);
    console.log(`✅ Saved to: ${filename}`);
    console.log(`📊 Total ingredients: ${result.rows.length}`);
    console.log(`🔴 High priority (no INCI): ${highUsageNoINCI.length}`);
    console.log(`🟡 Medium priority (no INCI): ${mediumUsageNoINCI.length}`);
    console.log(`🔍 Need verification: ${needVerification.length}`);
    
    console.log(`\n💼 NEXT STEPS:`);
    console.log(`1. Copy the contents of INCI_RESEARCH_LIST.md`);
    console.log(`2. Paste into a new Claude chat for INCI research`);
    console.log(`3. Get the research results back`);
    console.log(`4. Use verify-inci-research.js to update the database`);
    
    // Also create a simple CSV for backup
    const csvContent = [
      'ingredient_name,current_inci,used_in_formulas,min_percentage,max_percentage,avg_percentage,priority,category'
    ];
    
    result.rows.forEach(ing => {
      const priority = ing.used_in_formulas >= 5 ? 'HIGH' :
                      ing.used_in_formulas >= 2 ? 'MEDIUM' :
                      ing.used_in_formulas >= 1 ? 'LOW' : 'UNUSED';
      
      csvContent.push([
        `"${ing.name}"`,
        `"${ing.inci_name || ''}"`,
        ing.used_in_formulas,
        ing.min_percentage || '',
        ing.max_percentage || '',
        ing.avg_percentage || '',
        priority,
        `"${ing.category || ''}"`
      ].join(','));
    });
    
    const csvFilename = `/Users/earthharbor/projects/project-pel-lab/cosmetics-monday-integration/ingredients_for_research.csv`;
    fs.writeFileSync(csvFilename, csvContent.join('\n'));
    console.log(`📊 CSV backup saved to: ${csvFilename}`);
    
  } catch (error) {
    console.error('❌ Error extracting ingredients:', error.message);
  } finally {
    await pool.end();
  }
}

extractAllIngredients();