const { Pool } = require('pg');
require('dotenv').config();

async function analyzeMissingINCI() {
  console.log('🔍 ANALYZING INGREDIENTS WITHOUT INCI NAMES...\n');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Get ingredients without INCI names
    const missingInciQuery = `
      SELECT 
        i.id,
        i.name,
        i.category,
        COUNT(fi.formula_id) as used_in_formulas
      FROM ingredients i
      LEFT JOIN formula_ingredients fi ON i.id = fi.ingredient_id
      WHERE (i.inci_name IS NULL OR i.inci_name = '')
      GROUP BY i.id, i.name, i.category
      ORDER BY COUNT(fi.formula_id) DESC, i.name
    `;
    
    const result = await pool.query(missingInciQuery);
    
    console.log(`📊 INGREDIENTS WITHOUT INCI NAMES: ${result.rows.length}/563 total ingredients\n`);
    
    // Group by usage frequency
    const highUsage = result.rows.filter(row => row.used_in_formulas >= 5);
    const mediumUsage = result.rows.filter(row => row.used_in_formulas >= 2 && row.used_in_formulas < 5);
    const lowUsage = result.rows.filter(row => row.used_in_formulas === 1);
    const unused = result.rows.filter(row => row.used_in_formulas === 0);
    
    console.log('🔥 HIGH USAGE (5+ formulas) - PRIORITY INCI NEEDED:');
    if (highUsage.length > 0) {
      highUsage.slice(0, 10).forEach(ing => {
        console.log(`   • ${ing.name} (${ing.used_in_formulas} formulas) [${ing.category || 'No category'}]`);
      });
      if (highUsage.length > 10) {
        console.log(`   ... and ${highUsage.length - 10} more high-usage ingredients`);
      }
    } else {
      console.log('   ✅ None - all high-usage ingredients have INCI names!');
    }
    
    console.log(`\n📋 MEDIUM USAGE (2-4 formulas): ${mediumUsage.length} ingredients`);
    if (mediumUsage.length > 0 && mediumUsage.length <= 15) {
      mediumUsage.forEach(ing => {
        console.log(`   • ${ing.name} (${ing.used_in_formulas} formulas)`);
      });
    } else if (mediumUsage.length > 15) {
      mediumUsage.slice(0, 10).forEach(ing => {
        console.log(`   • ${ing.name} (${ing.used_in_formulas} formulas)`);
      });
      console.log(`   ... and ${mediumUsage.length - 10} more medium-usage ingredients`);
    }
    
    console.log(`\n📝 LOW USAGE (1 formula): ${lowUsage.length} ingredients`);
    console.log(`⚪ UNUSED (0 formulas): ${unused.length} ingredients`);
    
    // Show category breakdown
    const categoryBreakdown = {};
    result.rows.forEach(row => {
      const category = row.category || 'Uncategorized';
      categoryBreakdown[category] = (categoryBreakdown[category] || 0) + 1;
    });
    
    console.log('\n📊 MISSING INCI BY CATEGORY:');
    Object.entries(categoryBreakdown)
      .sort(([,a], [,b]) => b - a)
      .forEach(([category, count]) => {
        console.log(`   • ${category}: ${count} ingredients`);
      });
    
    // Get total statistics
    const totalStatsQuery = `
      SELECT 
        COUNT(*) as total_ingredients,
        COUNT(CASE WHEN inci_name IS NOT NULL AND inci_name != '' THEN 1 END) as with_inci,
        COUNT(CASE WHEN inci_name IS NULL OR inci_name = '' THEN 1 END) as without_inci
      FROM ingredients
    `;
    
    const statsResult = await pool.query(totalStatsQuery);
    const stats = statsResult.rows[0];
    
    console.log('\n🎯 INCI COVERAGE SUMMARY:');
    console.log(`   Total ingredients: ${stats.total_ingredients}`);
    console.log(`   With INCI names: ${stats.with_inci} (${((stats.with_inci / stats.total_ingredients) * 100).toFixed(1)}%)`);
    console.log(`   Without INCI names: ${stats.without_inci} (${((stats.without_inci / stats.total_ingredients) * 100).toFixed(1)}%)`);
    
    console.log('\n💡 RECOMMENDATIONS:');
    if (highUsage.length > 0) {
      console.log(`   🔴 HIGH PRIORITY: Research INCI names for ${highUsage.length} high-usage ingredients`);
    }
    if (mediumUsage.length > 0) {
      console.log(`   🟡 MEDIUM PRIORITY: Add INCI for ${mediumUsage.length} medium-usage ingredients`);
    }
    console.log(`   🟢 LOW PRIORITY: ${lowUsage.length + unused.length} ingredients used rarely or not at all`);
    
    console.log('\n📋 CURRENT INTEGRATION STATUS:');
    console.log(`   • Monday INCI automation is working on the ${stats.with_inci} ingredients that DO have INCI names`);
    console.log(`   • The ${stats.without_inci} ingredients without INCI will skip the INCI connection step`);
    console.log(`   • Formula-ingredient connections work perfectly regardless of INCI status`);
    console.log(`   • Mirror column will show INCI data only for ingredients that have INCI names`);
    
  } catch (error) {
    console.error('❌ Error analyzing missing INCI:', error.message);
  } finally {
    await pool.end();
  }
}

analyzeMissingINCI();