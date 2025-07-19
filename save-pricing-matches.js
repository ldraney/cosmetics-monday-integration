const csv = require('csv-parse');
const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

async function savePricingMatches() {
  console.log('💾 Saving InFlow Pricing Matches to File...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    // Read inFlow data
    const inflowPath = '/Users/earthharbor/Downloads/inFlow_ProductDetails (2).csv';
    let inflowData = fs.readFileSync(inflowPath, 'utf8');
    
    if (inflowData.charCodeAt(0) === 0xFEFF) {
      inflowData = inflowData.slice(1);
    }
    
    const inflowRecords = [];
    csv.parse(inflowData, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    }, (err, records) => {
      if (err) throw err;
      
      const ingredients = records.filter(record => {
        const name = record.ProductName.toLowerCase();
        const category = record.Category.toLowerCase();
        const cost = parseFloat(record.Cost || 0);
        
        if (name.includes('carton') || name.includes('box') || name.includes('sleeve') || 
            name.includes('insert') || name.includes('kit') || category.includes('carton')) {
          return false;
        }
        
        return cost > 0 || 
               name.includes('extract') || name.includes('oil') || name.includes('acid') ||
               name.includes('butter') || name.includes('glycerin') || name.includes('vitamin') ||
               name.includes('powder') || category.includes('powder') || category.includes('liquid') ||
               record.INCI;
      });
      
      ingredients.forEach(ing => inflowRecords.push(ing));
    });
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Get database ingredients
    const dbResult = await pool.query(`
      SELECT 
        i.id,
        i.name as ingredient_name,
        i.inci_name,
        COUNT(fi.formula_id) as usage_count,
        ROUND(AVG(fi.percentage)::numeric, 2) as avg_percentage
      FROM ingredients i
      LEFT JOIN formula_ingredients fi ON i.id = fi.ingredient_id
      GROUP BY i.id, i.name, i.inci_name
      ORDER BY COUNT(fi.formula_id) DESC, i.name
    `);
    
    // Match ingredients
    const matches = [];
    
    for (const dbIngredient of dbResult.rows) {
      const dbName = dbIngredient.ingredient_name.toLowerCase();
      const dbInci = (dbIngredient.inci_name || '').toLowerCase();
      
      for (const inflowItem of inflowRecords) {
        const inflowName = inflowItem.ProductName.toLowerCase();
        const inflowInci = (inflowItem.INCI || '').toLowerCase();
        const cost = parseFloat(inflowItem.Cost || 0);
        
        if (cost <= 0) continue;
        
        let matchScore = 0;
        
        if (dbName === inflowName) matchScore += 100;
        else if (dbName.includes(inflowName) || inflowName.includes(dbName)) matchScore += 70;
        else {
          const dbWords = dbName.split(/\\s+/);
          const inflowWords = inflowName.split(/\\s+/);
          const commonWords = dbWords.filter(word => 
            word.length > 3 && inflowWords.some(iw => iw.includes(word) || word.includes(iw))
          );
          matchScore += commonWords.length * 20;
        }
        
        if (dbInci && inflowInci && dbInci === inflowInci) matchScore += 50;
        else if (dbInci && inflowInci && (dbInci.includes(inflowInci) || inflowInci.includes(dbInci))) matchScore += 30;
        
        if (matchScore >= 60) {
          matches.push({
            database_ingredient_id: dbIngredient.id,
            database_ingredient_name: dbIngredient.ingredient_name,
            database_inci_name: dbIngredient.inci_name,
            usage_count: dbIngredient.usage_count,
            avg_percentage: dbIngredient.avg_percentage,
            inflow_product_name: inflowItem.ProductName,
            inflow_sku: inflowItem.SKU,
            inflow_cost: parseFloat(inflowItem.Cost || 0),
            inflow_unit: inflowItem.Uom || 'each',
            inflow_description: inflowItem.Description || '',
            inflow_inci: inflowItem.INCI || '',
            match_score: matchScore,
            estimated_cost_per_kg: estimateCostPerKg({
              cost_per_unit: cost,
              unit: inflowItem.Uom || 'each'
            })
          });
        }
      }
    }
    
    // Get best matches
    const bestMatches = [];
    const usedDbIngredients = new Set();
    
    matches.sort((a, b) => b.match_score - a.match_score);
    
    for (const match of matches) {
      const dbId = match.database_ingredient_id;
      if (!usedDbIngredients.has(dbId)) {
        bestMatches.push(match);
        usedDbIngredients.add(dbId);
      }
    }
    
    // Save to JSON file
    const outputData = {
      extraction_date: new Date().toISOString(),
      source_file: 'inFlow_ProductDetails (2).csv',
      total_inflow_ingredients: inflowRecords.length,
      total_database_ingredients: dbResult.rows.length,
      total_matches_found: matches.length,
      best_matches_count: bestMatches.length,
      matches: bestMatches
    };
    
    fs.writeFileSync('inflow-pricing-matches.json', JSON.stringify(outputData, null, 2));
    
    // Also save CSV for easy viewing
    const csvHeader = 'Database_Ingredient,INCI_Name,Usage_Count,InFlow_Product,Cost_USD,Unit,Cost_Per_KG_USD,Match_Score\\n';
    const csvRows = bestMatches.map(match => 
      `"${match.database_ingredient_name}","${match.database_inci_name || ''}",${match.usage_count},"${match.inflow_product_name}",${match.inflow_cost},"${match.inflow_unit}",${match.estimated_cost_per_kg},${match.match_score}%`
    ).join('\\n');
    
    fs.writeFileSync('inflow-pricing-matches.csv', csvHeader + csvRows);
    
    console.log(`\\n💾 PRICING DATA SAVED!`);
    console.log(`📄 JSON: inflow-pricing-matches.json`);
    console.log(`📄 CSV: inflow-pricing-matches.csv`);
    console.log(`\\n📊 Summary:`);
    console.log(`  • ${bestMatches.length} ingredient pricing matches`);
    console.log(`  • ${bestMatches.filter(m => m.usage_count > 0).length} ingredients actually used in formulas`);
    console.log(`  • Average cost: $${(bestMatches.reduce((sum, m) => sum + m.estimated_cost_per_kg, 0) / bestMatches.length).toFixed(2)}/kg`);
    
    // Show top formula ingredients with pricing
    const topFormulaIngredients = bestMatches
      .filter(m => m.usage_count >= 3)
      .slice(0, 15);
      
    console.log(`\\n🔝 TOP FORMULA INGREDIENTS WITH PRICING:`);
    topFormulaIngredients.forEach((match, i) => {
      console.log(`${i+1}. ${match.database_ingredient_name} - $${match.estimated_cost_per_kg}/kg (used in ${match.usage_count} formulas)`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

function estimateCostPerKg(match) {
  const cost = parseFloat(match.cost_per_unit);
  const unit = (match.unit || 'each').toLowerCase();
  
  if (unit.includes('kg') || unit.includes('kilo')) {
    return cost;
  } else if (unit.includes('g') && !unit.includes('kg')) {
    return cost * 1000;
  } else if (unit.includes('oz')) {
    return cost * 35.274;
  } else if (unit.includes('lb') || unit.includes('pound')) {
    return cost * 2.205;
  } else {
    return cost;
  }
}

savePricingMatches();