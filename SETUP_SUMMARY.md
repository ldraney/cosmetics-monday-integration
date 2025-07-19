# Monday.com Cosmetics Integration - Complete Setup Analysis

## Overview

This document provides a complete analysis of your current Monday.com TEST board setup and instructions for replicating it programmatically.

## Current Setup Structure

### Board Hierarchy
```
🧪 Cosmetics Formulas - TEST (9625728737)
    ↓ (connects to)
🧪 Ingredients Master Database (9625733140)  
    ↓ (connects to)
🧬 INCI Master Database (9625740593)
    ↑ (mirrors back to show INCI names in Formulas)
```

### Key Configuration Details

**Workspace**: Cosmetics Testing Lab (ID: 11691826)

#### 1. Formulas Board (9625728737)
- **Connection Column**: "🧪 Ingredients Master Database" (board_relation_mkt08v2f)
  - Connects to: Ingredients Master Database (9625733140)
- **Mirror Column**: "INCI Names" (lookup_mkt0fyfk)
  - Mirrors ingredient data from the Ingredients board
  - Shows INCI names from connected ingredients

#### 2. Ingredients Master Database (9625733140)
- **Connection to INCI**: "🧬 INCI Master Database" (board_relation_mkt0k7xm)
  - Connects to: INCI Master Database (9625740593)
- **Reverse Connection**: "link to 🧪 Cosmetics Formulas - TEST" (board_relation_mkt0de9d)
  - Connects back to: Formulas board (9625728737)

#### 3. INCI Master Database (9625740593)
- **Reverse Connection**: "link to 🧪 Ingredients Master Database" (board_relation_mkt0nqcq)
  - Connects back to: Ingredients board (9625733140)

## How It Works

1. **Formula Creation**: Add formulas to the Formulas board
2. **Ingredient Connection**: Connect each formula to its ingredients using the connection column
3. **INCI Lookup**: Each ingredient is connected to its INCI name in the INCI board
4. **Automatic Display**: The mirror column automatically shows INCI names for all connected ingredients

## Data Flow Example

```
Formula: "Moisturizing Cream"
    ↓ connects to
Ingredients: ["Water", "Glycerin", "Cetyl Alcohol"]
    ↓ each connects to  
INCI Names: ["Aqua", "Glycerin", "Cetyl Alcohol"]
    ↑ mirrors back as
INCI Names Column: "Aqua, Glycerin, Cetyl Alcohol"
```

## Replication Scripts

### Available Scripts

1. **`discover-boards.js`** - Discovers all Monday.com boards and identifies cosmetics-related ones
2. **`analyze-test-board-setup.js`** - Analyzes the specific TEST board configuration
3. **`replicate-test-setup.js`** - Replicates the setup programmatically
4. **`document-test-setup.js`** - Documents complete configuration for reference

### Usage

```bash
# Discover your boards
node discover-boards.js

# Analyze current setup
node analyze-test-board-setup.js

# Replicate setup (dry run first)
node replicate-test-setup.js --dry-run

# Replicate setup (actual)
node replicate-test-setup.js

# Document configuration
node document-test-setup.js
```

## Key Column IDs for Reference

```javascript
// Board IDs
const FORMULAS_BOARD_ID = "9625728737";
const INGREDIENTS_BOARD_ID = "9625733140"; 
const INCI_BOARD_ID = "9625740593";

// Connection Column IDs
const FORMULAS_TO_INGREDIENTS_COLUMN = "board_relation_mkt08v2f";
const INGREDIENTS_TO_INCI_COLUMN = "board_relation_mkt0k7xm";

// Mirror Column ID
const INCI_NAMES_MIRROR_COLUMN = "lookup_mkt0fyfk";
```

## API Configuration for Mirror Column

The INCI Names mirror column has this configuration:
```json
{
  "relation_column": {
    "board_relation_mkt08v2f": true
  },
  "displayed_column": {},
  "displayed_linked_columns": {
    "9625733140": ["long_text_mkt0t76d"]
  }
}
```

This means:
- It uses the ingredients connection column (`board_relation_mkt08v2f`) as the relationship
- It displays data from the linked ingredients board (`9625733140`)
- Specifically shows the `long_text_mkt0t76d` column content

## Programmatic Replication Steps

To create this setup programmatically:

### 1. Create the Boards
```javascript
// Create INCI board first (no dependencies)
const inciBoard = await createBoard("🧬 INCI Master Database", workspace);

// Create Ingredients board 
const ingredientsBoard = await createBoard("🧪 Ingredients Master Database", workspace);

// Create Formulas board
const formulasBoard = await createBoard("🧪 Cosmetics Formulas - TEST", workspace);
```

### 2. Create Connection Columns
```javascript
// Ingredients → INCI connection
await createColumn(ingredientsBoard.id, {
  title: "🧬 INCI Master Database",
  column_type: "board_relation", 
  defaults: `{"boardIds":["${inciBoard.id}"]}`
});

// Formulas → Ingredients connection  
const connectionColumn = await createColumn(formulasBoard.id, {
  title: "🧪 Ingredients Master Database",
  column_type: "board_relation",
  defaults: `{"boardIds":["${ingredientsBoard.id}"]}`
});
```

### 3. Create Mirror Column
```javascript
// INCI Names mirror on Formulas board
await createColumn(formulasBoard.id, {
  title: "INCI Names",
  column_type: "mirror",
  defaults: JSON.stringify({
    mirrorBoardId: ingredientsBoard.id,
    mirrorColumnId: "long_text_mkt0t76d", // The INCI text column
    dependencyColumnId: connectionColumn.id
  })
});
```

## Benefits of This Setup

1. **Automatic INCI Display**: Once you connect ingredients to a formula, their INCI names appear automatically
2. **Centralized Data**: All INCI names are managed in one place
3. **Data Consistency**: Changes to INCI names propagate automatically to all formulas
4. **Scalable**: Easy to add new ingredients and INCI names
5. **Visual**: Mirror columns provide immediate visual feedback

## Maintenance Notes

- INCI names should be maintained in the INCI Master Database
- Ingredients should be connected to their corresponding INCI entries
- Formulas connect to ingredients, and INCI names appear automatically
- The mirror column updates in real-time when connections change

## Environment Variables

Update your `.env` file with these board IDs:
```env
FORMULAS_BOARD_ID=9625728737
INGREDIENTS_BOARD_ID=9625733140
INCI_BOARD_ID=9625740593
```