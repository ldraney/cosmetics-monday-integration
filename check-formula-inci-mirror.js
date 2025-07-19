const mondaySDK = require('monday-sdk-js');
require('dotenv').config();

const monday = mondaySDK();
monday.setToken(process.env.MONDAY_API_TOKEN);

async function checkFormulaINCIMirror() {
  try {
    const testBoardId = '9625728737'; // Formulas board
    const inciMirrorColumnId = 'mirror_11nkfq'; // INCI Names mirror column
    
    console.log('🔍 Checking formulas for INCI mirror data...\n');
    
    const formulasQuery = `
      query {
        boards(ids: [${testBoardId}]) {
          name
          items_page(limit: 20) {
            items {
              id
              name
              column_values(ids: ["${inciMirrorColumnId}"]) {
                id
                type
                text
                value
              }
            }
          }
        }
      }
    `;
    
    const response = await monday.api(formulasQuery);
    const board = response.data?.boards?.[0];
    const formulas = board?.items_page?.items || [];
    
    console.log(`📋 Board: ${board?.name}`);
    console.log(`📊 Checking ${formulas.length} formulas for INCI data...\n`);
    
    let formulasWithINCIData = 0;
    
    formulas.forEach((formula, index) => {
      const inciColumn = formula.column_values?.[0];
      const inciText = inciColumn?.text || '';
      const hasINCIData = inciText && inciText.trim() !== '' && inciText !== '-';
      
      if (hasINCIData) {
        formulasWithINCIData++;
        console.log(`✅ ${formula.name}`);
        console.log(`   INCI: ${inciText.substring(0, 100)}${inciText.length > 100 ? '...' : ''}\n`);
      } else {
        console.log(`⚠️  ${formula.name} - No INCI data yet`);
      }
    });
    
    console.log(`\n📊 MIRROR COLUMN RESULTS:`);
    console.log(`   Formulas with INCI data: ${formulasWithINCIData}/${formulas.length}`);
    console.log(`   Coverage: ${((formulasWithINCIData / formulas.length) * 100).toFixed(1)}%`);
    
    if (formulasWithINCIData > 0) {
      console.log('\n🎉 SUCCESS! INCI mirror column is working!');
      console.log('✅ Formulas are showing INCI names from connected ingredients');
      console.log('🔗 Full integration chain: Formulas → Ingredients → INCI → Mirror');
    } else {
      console.log('\n⏳ Mirror column may need time to sync');
      console.log('🔄 INCI connections may still be processing');
    }
    
  } catch (error) {
    console.error('❌ Error checking INCI mirror:', error.message);
  }
}

checkFormulaINCIMirror();