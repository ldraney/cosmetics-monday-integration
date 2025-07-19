const csv = require('csv-parse');
const fs = require('fs');
const { Pool } = require('pg');
const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();

async function matchInflowPricing() {
  console.log('💰 Matching inFlow Inventory Pricing to Formula Ingredients...');
  
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    monday.setToken(process.env.MONDAY_API_TOKEN);
    
    // Step 1: Read inFlow inventory data
    console.log('📊 Reading inFlow inventory data...');
    
    const inflowPath = '/Users/earthharbor/Downloads/inFlow_ProductDetails (2).csv';
    let inflowData = fs.readFileSync(inflowPath, 'utf8');
    
    // Remove UTF-8 BOM if present
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
      
      // Filter for ingredient-like items (not packaging)
      const ingredients = records.filter(record => {
        const name = record.ProductName.toLowerCase();
        const category = record.Category.toLowerCase();
        const cost = parseFloat(record.Cost || 0);
        
        // Skip obvious packaging
        if (name.includes('carton') || name.includes('box') || name.includes('sleeve') || 
            name.includes('insert') || name.includes('kit') || category.includes('carton')) {
          return false;
        }
        
        // Include if it looks like an ingredient
        return cost > 0 || 
               name.includes('extract') || name.includes('oil') || name.includes('acid') ||
               name.includes('butter') || name.includes('glycerin') || name.includes('vitamin') ||
               name.includes('powder') || category.includes('powder') || category.includes('liquid') ||
               record.INCI; // Has INCI name
      });
      
      console.log(`✅ Found ${ingredients.length} ingredient-like items in inFlow`);
      
      ingredients.forEach(ing => inflowRecords.push(ing));
    });
    
    // Wait a moment for CSV parsing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Step 2: Get formula ingredients from database
    console.log('📊 Getting formula ingredients from database...');
    
    const formulaIngredientsQuery = `
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
    `;
    
    const dbResult = await pool.query(formulaIngredientsQuery);
    console.log(`✅ Found ${dbResult.rows.length} ingredients in formula database`);
    
    // Step 3: Match ingredients using fuzzy matching
    console.log('🔍 Matching ingredients using fuzzy name matching...');
    
    const matches = [];
    
    for (const dbIngredient of dbResult.rows) {
      const dbName = dbIngredient.ingredient_name.toLowerCase();
      const dbInci = (dbIngredient.inci_name || '').toLowerCase();
      
      for (const inflowItem of inflowRecords) {
        const inflowName = inflowItem.ProductName.toLowerCase();
        const inflowInci = (inflowItem.INCI || '').toLowerCase();
        const cost = parseFloat(inflowItem.Cost || 0);
        
        if (cost <= 0) continue; // Skip items without cost
        
        // Calculate match score
        let matchScore = 0;
        
        // Direct name match
        if (dbName === inflowName) matchScore += 100;
        // Partial name match
        else if (dbName.includes(inflowName) || inflowName.includes(dbName)) matchScore += 70;
        // Word overlap
        else {
          const dbWords = dbName.split(/\\s+/);
          const inflowWords = inflowName.split(/\\s+/);
          const commonWords = dbWords.filter(word => 
            word.length > 3 && inflowWords.some(iw => iw.includes(word) || word.includes(iw))
          );
          matchScore += commonWords.length * 20;
        }
        
        // INCI match bonus
        if (dbInci && inflowInci && dbInci === inflowInci) matchScore += 50;
        else if (dbInci && inflowInci && (dbInci.includes(inflowInci) || inflowInci.includes(dbInci))) matchScore += 30;
        
        // Only consider matches with decent confidence
        if (matchScore >= 60) {
          matches.push({
            db_ingredient: dbIngredient,
            inflow_item: inflowItem,
            match_score: matchScore,
            cost_per_unit: cost,
            unit: inflowItem.Uom || 'each',
            description: inflowItem.Description || ''
          });
        }
      }
    }
    
    // Sort by match score and remove duplicates (keep best match per DB ingredient)
    console.log(`🎯 Found ${matches.length} potential matches`);
    
    const bestMatches = [];
    const usedDbIngredients = new Set();
    
    matches.sort((a, b) => b.match_score - a.match_score);
    
    for (const match of matches) {
      const dbId = match.db_ingredient.id;
      if (!usedDbIngredients.has(dbId)) {
        bestMatches.push(match);
        usedDbIngredients.add(dbId);
      }
    }
    
    console.log(`✅ Selected ${bestMatches.length} best matches for pricing update`);
    
    // Step 4: Show matches for review
    console.log('\\n📋 TOP 20 PRICING MATCHES:');
    bestMatches.slice(0, 20).forEach((match, i) => {
      const costPerKg = estimateCostPerKg(match);
      console.log(`${i+1}. ${match.db_ingredient.ingredient_name}`);
      console.log(`   ↔ ${match.inflow_item.ProductName} ($${match.cost_per_unit}/${match.unit})`);
      console.log(`   💰 Est. $${costPerKg}/kg | Score: ${match.match_score}% | Used in ${match.db_ingredient.usage_count} formulas`);
      console.log('');
    });
    
    // Step 5: Upload pricing to Monday.com
    console.log('🚀 Uploading pricing data to Monday.com...');
    
    const ingredientsBoardId = process.env.INGREDIENTS_BOARD_ID;
    let updatedCount = 0;
    
    // Get board items first to match by name and check existing pricing
    const boardQuery = `
      query {
        boards(ids: [${ingredientsBoardId}]) {
          items_page(limit: 500) {
            items {
              id
              name
              column_values(ids: ["numeric_mkt0v0h6"]) {
                id
                text
                value
              }
            }
          }
        }
      }
    `;
    
    const boardResponse = await monday.api(boardQuery);
    const boardData = boardResponse.boards?.[0] || boardResponse.data?.boards?.[0];
    const boardItems = boardData?.items_page?.items || boardData?.items || [];
    
    console.log(`📋 Found ${boardItems.length} items in Monday ingredients board`);
    
    // Update pricing for matched ingredients
    const batchSize = 5;
    for (let i = 0; i < bestMatches.length; i += batchSize) {
      const batch = bestMatches.slice(i, i + batchSize);
      
      for (const match of batch) {
        try {
          // Find the Monday item by name matching
          const mondayItem = boardItems.find(item => 
            item.name.toLowerCase().includes(match.db_ingredient.ingredient_name.toLowerCase()) ||
            match.db_ingredient.ingredient_name.toLowerCase().includes(item.name.toLowerCase())
          );
          
          if (mondayItem) {
            // Check if item already has pricing
            const priceColumn = mondayItem.column_values.find(cv => cv.id === 'numeric_mkt0v0h6');
            if (priceColumn && priceColumn.text && priceColumn.text !== '' && priceColumn.text !== '0') {
              // Skip items that already have pricing
              continue;
            }
            
            const costPerKg = estimateCostPerKg(match);
            
            const updateMutation = `
              mutation {
                change_column_value (
                  board_id: ${ingredientsBoardId},
                  item_id: ${mondayItem.id},
                  column_id: "numeric_mkt0v0h6",
                  value: "${costPerKg}"
                ) {
                  id
                }
              }
            `;
            
            await monday.api(updateMutation);
            updatedCount++;
            
            if (updatedCount <= 10) {
              console.log(`  ✅ Updated: ${match.db_ingredient.ingredient_name} → $${costPerKg}/kg`);
            }
          }
          
        } catch (error) {
          console.error(`❌ Error updating ${match.db_ingredient.ingredient_name}:`, error.message);
        }
      }
      
      console.log(`  📊 Updated ${Math.min(updatedCount, bestMatches.length)} / ${bestMatches.length} ingredients...`);
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`\\n🎉 PRICING UPDATE COMPLETE!`);
    console.log(`💰 Updated ${updatedCount} ingredients with pricing data`);
    console.log(`🔗 View updated board: https://monday.com/boards/${ingredientsBoardId}`);
    
    // Summary statistics
    const totalValue = bestMatches.reduce((sum, match) => sum + estimateCostPerKg(match), 0);
    const avgCostPerKg = totalValue / bestMatches.length;
    
    console.log(`\\n📈 Pricing Summary:`);
    console.log(`  • Average cost per kg: $${avgCostPerKg.toFixed(2)}`);
    console.log(`  • Price range: $${Math.min(...bestMatches.map(m => estimateCostPerKg(m))).toFixed(2)} - $${Math.max(...bestMatches.map(m => estimateCostPerKg(m))).toFixed(2)}`);
    console.log(`  • Coverage: ${updatedCount}/${dbResult.rows.length} ingredients (${((updatedCount/dbResult.rows.length)*100).toFixed(1)}%)`);
    
  } catch (error) {
    console.error('❌ Error matching inFlow pricing:', error.message);
    if (error.response?.data) {
      console.error('API Response:', error.response.data);
    }
  } finally {
    await pool.end();
  }
}

function estimateCostPerKg(match) {
  const cost = parseFloat(match.cost_per_unit);
  const unit = (match.unit || 'each').toLowerCase();
  
  // Convert to cost per kg
  if (unit.includes('kg') || unit.includes('kilo')) {
    return cost;
  } else if (unit.includes('g') && !unit.includes('kg')) {
    return cost * 1000; // grams to kg
  } else if (unit.includes('oz')) {
    return cost * 35.274; // oz to kg
  } else if (unit.includes('lb') || unit.includes('pound')) {
    return cost * 2.205; // lb to kg
  } else {
    // Estimate based on typical ingredient density (assume ~1kg per unit for powders/liquids)
    return cost;
  }
}

if (require.main === module) {
  matchInflowPricing();
}

module.exports = { matchInflowPricing };