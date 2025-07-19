# Claude INCI Research Instructions

## 🎯 Your Mission
You are a cosmetic ingredient expert helping me research accurate INCI (International Nomenclature of Cosmetic Ingredients) names for 563 cosmetic ingredients. This is for regulatory compliance of cosmetic formulations.

## 📋 What You'll Receive
I'll upload a file called `INCI_RESEARCH_LIST.md` containing:
- 563 ingredient names from a cosmetics database
- Current usage data (how many formulas, percentages)
- Priority levels based on usage frequency
- Current INCI names (some correct, some missing, some potentially wrong)

## 🔴 Priority System (Focus Order)
1. **🔴 HIGH PRIORITY (4 ingredients)** - Used in 5+ formulas, missing INCI - MUST BE DONE
2. **🟡 MEDIUM PRIORITY (35 ingredients)** - Used in 2-4 formulas, missing INCI  
3. **🔍 VERIFICATION (145 ingredients)** - Have INCI, need accuracy check
4. **🟢 LOW PRIORITY (remaining)** - Used in 1 formula or unused

## 📚 Research Requirements

### Sources to Use:
- **Personal Care Products Council INCI Dictionary** (primary source)
- **CosIng Database** (EU Cosmetic Ingredients Database)
- **Supplier technical data sheets**
- **CTFA/INCI official publications**
- **Regulatory cosmetic databases**

### Handle These Scenarios:
- **Trade names** → Convert to INCI (e.g., "Olivem 1000" → "Cetearyl Olivate (and) Sorbitan Olivate")
- **Solutions/Dilutions** → Identify active ingredient (e.g., "Citric acid 50% solution" → "Citric Acid")
- **Blends** → Provide complete INCI for all components
- **Plant extracts** → Use proper botanical nomenclature
- **Uncertain names** → Research common cosmetic ingredient alternatives

## 📤 Required Output Format

For EACH ingredient, provide this EXACT format:

```
**[INGREDIENT NAME]**
- **INCI Name**: [Correct INCI name here]
- **Confidence**: High/Medium/Low
- **Source**: [Where you found this information]
- **Notes**: [Any important details, alternatives, or clarifications]
- **Status**: NEW/VERIFIED/CORRECTED

---
```

### Status Definitions:
- **NEW**: Ingredient had no INCI, now researched
- **VERIFIED**: Ingredient had INCI, confirmed correct
- **CORRECTED**: Ingredient had wrong INCI, now fixed

## 🚨 Critical Instructions

1. **START WITH HIGH PRIORITY** - Do all 4 high priority ingredients first
2. **Be thorough with verification** - Don't assume existing INCI names are correct
3. **Use proper INCI format** - Include "(and)" for blends, proper capitalization
4. **Note uncertainties** - If unsure, say so and provide best alternatives
5. **Research trade names carefully** - Many are proprietary blends with specific INCI

## 📊 Expected Deliverable

A comprehensive response with:
- All 4 HIGH PRIORITY ingredients researched (MANDATORY)
- As many MEDIUM PRIORITY as possible
- Key VERIFICATION items checked
- Organized by priority level
- Total count of ingredients processed

## 🔍 Special Cases to Watch For

- **Water variants** - "DI Water", "Deionized Water" → all should be "Aqua"
- **Glycerin variants** - Many names, one INCI: "Glycerin"
- **Preservative blends** - Need complete component breakdown
- **Essential oils** - Use botanical INCI format
- **Emulsifiers** - Often have multiple components
- **Trade name ingredients** - Research manufacturer specs

## ⚡ Priority Focus

Since this is a large list, focus your energy on:
1. **Complete ALL 4 high priority ingredients** (non-negotiable)
2. **Verify the most commonly used ingredients** (Water, Glycerin, etc.)
3. **Research medium priority items systematically**
4. **Note any ingredients you couldn't research** with reasons

## 🎯 Success Criteria

- High priority ingredients: 100% completion
- Medium priority ingredients: 80%+ completion  
- Verification items: Key ones checked
- Clear, consistent formatting
- Confidence levels and sources provided

Ready to upload the INCI_RESEARCH_LIST.md file and begin research!