# Monday.com Setup: One-Time Manual Configuration

## Overview

Monday.com requires a one-time manual setup for board connections, after which everything can be automated via API.

### The One Manual Step

**What needs manual setup**: Creating and configuring the "connect_boards" column

**Why**: Monday.com API doesn't support creating `connect_boards` columns programmatically - this is by design for security/governance reasons.

**Time required**: ~2 minutes

### What We CAN Do Via API (After Manual Setup)

✅ **Create all the actual connections** (1,057 formula-ingredient relationships)  
✅ **Update connections when formulas change**  
✅ **Sync new ingredients and formulas**  
✅ **Calculate costs automatically**  
✅ **Update pricing in real-time**  
✅ **Generate reports and analytics**  

### Setup Instructions

1. **Go to your Formulas Board**
2. **Add a "Connect boards" column**:
   - Click "+" to add column
   - Choose "Connect boards" type
   - Name it "Connected Ingredients"
   - Select "Ingredients Master Database" as the connected board
   - Enable "Create a two-way connection"
3. **Save the column**

That's it! Now run:
```bash
node create-formula-connections.js
```

This will create all 1,057 connections automatically.

### Technical Details

What we discovered in our testing

1. **Creating connect_boards column** ❌
   ```graphql
   mutation {
     create_column (
       board_id: 9625728737,
       title: "Formula Ingredients",
       column_type: connect_boards  # NOT SUPPORTED
     )
   }
   ```
   Result: API error - column type not supported

2. **Modifying dependency column settings** ❌
   - Attempted to change `boardIds` in column settings
   - API does not support `change_column_metadata` mutation
   - Column settings are immutable after creation

3. **Deleting and recreating dependency column** ❌
   - Successfully deleted column
   - Recreated with different settings
   - Still pointed to same board despite settings

### What This Enables

Once the manual setup is done, you get:
- ✅ Visual connections between formulas and ingredients
- ✅ Click-through navigation from formula → ingredients
- ✅ Automatic cost rollups based on connections
- ✅ True relational database experience in Monday.com
- ✅ Two-way visibility (see which formulas use an ingredient)

### Automation Scripts Ready

We've built scripts that will work after the manual setup:
- `create-formula-connections.js` - Creates all 1,057 connections
- `update-connections.js` - Updates when formulas change
- `sync-new-formulas.js` - Adds connections for new formulas

### Statistics

- **Total connections to create**: 1,057 formula-ingredient relationships
- **Time for manual setup**: ~2 minutes
- **Time to create connections via API**: ~3 minutes
- **Result**: Full visual relationship mapping

### Monday.com's Position

Based on API documentation and community discussions:
- This is an intentional limitation
- Connect boards columns require manual UI configuration
- No plans announced to add API support
- Recommended approach is to use external automation tools

### Why This Approach Still Rocks

1. **One-time setup**: Just 2 minutes of manual config, then fully automated
2. **Better than alternatives**:
   - Airtable: More expensive, less collaborative
   - Google Sheets: No visual connections at all
   - Custom database: No built-in UI or collaboration
3. **Monday's strengths**:
   - Beautiful UI for non-technical users
   - Built-in collaboration features
   - Automation recipes for workflows
   - Mobile apps for field access

### Next Steps

1. Do the 2-minute manual setup (instructions above)
2. Run `node create-formula-connections.js`
3. Enjoy your fully connected formula management system!

The Monday.com approach remains the best solution for collaborative formula management with visual relationships and automatic cost tracking.
