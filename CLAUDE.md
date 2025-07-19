# CLAUDE.md

This file provides guidance to Claude Code when working with the cosmetics Monday.com integration project.

## 🎯 Project Purpose

This is a **comprehensive Monday.com integration platform** for cosmetics formula management. The project creates a sophisticated pricing and relationship tracking system by syncing data from the local cosmetics database to Monday.com boards for advanced project management, cost analysis, and vendor coordination.

## 📊 Current Integration Status (2025-07-19)

### ✅ **COMPLETED:**
- **96.2% Formula Connections** (75/78 formulas linked to ingredients)
- **1,022 Formula-Ingredient Relationships** (complete visual navigation)
- **88.5% INCI Automation** (300/339 ingredient-INCI connections)
- **95 Ingredients with Pricing** (81.9% coverage from inFlow inventory)
- **Cost Calculation System** (working, needs pricing corrections)
- **563 Ingredients Research List** (ready for Claude.ai)

### 🔄 **NEXT PHASE: INCI Research & Complete Regulatory Compliance**
- Upload research data to Claude.ai for 100% INCI coverage
- Process results to achieve complete regulatory compliance
- Enhanced Monday boards with professional metadata

## 🏗️ Key Architecture

- **Data Source**: Local PostgreSQL database (`cosmetics_data_hub_v2_local`)
- **Target**: Monday.com workspace with interconnected boards
- **Approach**: Read-only operations on source data, create/update Monday boards with full relationship mapping
- **Safety**: No modifications to source database, comprehensive backup system

## 🚀 Available Commands

### Core Integration
- `node sync-all-ingredients.js` - Sync all 563 ingredients to Monday board
- `node calculate-formula-costs.js` - Calculate real-time formula costs using Monday pricing
- `node connect-ingredients-inci.js` - Link ingredients to INCI compliance data
- `node upload-remaining-pricing.js` - Batch upload pricing from inFlow inventory
- `node check-pricing-status.js` - Monitor pricing coverage and gaps

### Enhanced Analysis
- `node update-formula-details.js` - Update formulas with detailed ingredient breakdowns
- `node connect-formula-ingredients.js` - Create dependency relationships between formulas and ingredients
- `node check-missing-data.js` - Identify data gaps and sync issues
- `node board-status-monitor.js` - Comprehensive board health monitoring

### Development & Diagnostics
- `npm install` - Install dependencies
- `node debug-monday-api.js` - Test Monday API connectivity and permissions
- `node check-board-structure.js` - Analyze board column structures
- Add `--dry-run` to any sync script for preview mode

## Data Sources Available

### 1. Local Database (Primary)
- **Path**: `postgres://earthharbor@localhost:5432/cosmetics_data_hub_v2_local`
- **Status**: 78 formulas, 563 ingredients, 92.3% health
- **INCI Coverage**: 60.2% (339/563 ingredients)

### 2. JSON Export (Backup)
- **Path**: `../cosmetics-data-hub-v2-standalone/prod-data-export-2025-07-19.json`
- **Contains**: Complete database export with relationships

### 3. SQL Backup (Restore)
- **Path**: `../cosmetics-data-hub-v2-standalone/cosmetics_database_backup_20250718_193234.sql`
- **Use**: Full database restoration if needed

### 4. Original Excel (Reference)
- **Path**: `~/Downloads/Pure Earth Labs Finalized Formula.xlsx`
- **Contains**: Source truth with 86 formula sheets

## Environment Setup

Required environment variables:
```env
MONDAY_API_TOKEN=your_monday_api_token_here
DATABASE_URL=postgres://earthharbor@localhost:5432/cosmetics_data_hub_v2_local
```

## Monday.com Integration Details

### API Token Requirements
- Scope: Read/Write access to boards and items
- Source: https://monday.com/developers/v2
- Rate Limit: 10 requests/second

### Board Structure Created (4-Tier Integration)
1. **🧬 INCI Master Database**: 107+ INCI names for compliance tracking
2. **🧪 Ingredients Master Database**: 563 ingredients with pricing, INCI connections, and vendor data
3. **🧪 Cosmetics Formulas**: 78 formulas with cost calculations, ingredient dependencies, and status tracking
4. **💰 Ingredient Pricing Analysis**: Cost optimization and vendor comparison data

### Advanced Features
- **Real-time Cost Calculations**: Automatic formula cost updates when ingredient prices change
- **Dependency Mapping**: Full traceability from formulas → ingredients → INCI → vendors
- **Pricing Intelligence**: 81.9% coverage with inFlow inventory integration
- **Compliance Tracking**: INCI name validation and regulatory documentation
- **Vendor Integration**: Ready for connection to vendors board for supply chain management

## Safety Protocols

1. **Read-Only Source**: Never modify the source cosmetics database
2. **Dry Run First**: Always test with `--dry-run` flag before syncing
3. **Backup Before**: Create backups before major operations
4. **API Limits**: Respect Monday.com rate limits (built into scripts)

## Database Connection

The project connects to the local PostgreSQL database from the main cosmetics project:

```javascript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://earthharbor@localhost:5432/cosmetics_data_hub_v2_local'
});
```

## File Organization

- `sync-formulas.js` - Main sync logic for formulas
- `create-pricing-board.js` - Pricing analysis board creation
- `backup-database.js` - Database backup utilities
- `restore-database.js` - Database restore from SQL/JSON
- `lib/` - Shared utilities (database, Monday API, helpers)

## Common Use Cases

### Daily Sync Workflow
1. `npm run sync -- --dry-run` (preview changes)
2. `npm run sync` (sync formulas to Monday)
3. `npm run pricing` (update pricing analysis)

### Initial Setup
1. `npm install` (install dependencies)
2. Configure `.env` with Monday API token
3. Test database connection
4. Create initial boards with sync

### INCI Research & Upload Workflow (NEXT STEPS)
**🎯 YOU ARE HERE: Ready for Claude.ai INCI research**

1. **Upload to Claude.ai**: 
   - Copy `claude-inci-prompt.md` content as instructions
   - Upload `INCI_RESEARCH_LIST.md` file (563 ingredients)
   - Request complete research for all ingredients

2. **Save Results**: 
   - Save Claude's research response as `claude-inci-results.md`
   - Place in this project directory

3. **Process & Auto-Upload**: 
   - `node process-inci-research.js --file claude-inci-results.md`
   - This automatically updates database AND uploads to Monday

4. **Complete Integration**: 
   - `node enhanced-inci-automation.js` (95%+ connections)
   - `node add-inci-board-columns.js` (regulatory columns)

5. **Verify Results**: 
   - Check formula mirror columns for INCI data
   - Monitor Monday boards for complete integration

### Data Recovery
1. `npm run backup` (create current state backup)
2. `npm run restore -- backup_file.sql` (restore from backup)

## Integration Notes

- **Standalone Operation**: Runs independently of main cosmetics app
- **Data Consistency**: Reads same database as main app
- **No Conflicts**: Only creates Monday boards, doesn't modify source
- **Version Control**: Track Monday board configurations in git

## Troubleshooting

### Database Issues
- Check if PostgreSQL is running: `brew services list | grep postgres`
- Test connection: `psql -h localhost -p 5432 -U earthharbor -d cosmetics_data_hub_v2_local`
- Restore if needed: `npm run restore -- ../cosmetics-data-hub-v2-standalone/cosmetics_database_backup_20250718_193234.sql`

### Monday.com Issues  
- Verify API token permissions
- Check rate limiting (10 req/sec)
- Confirm board access rights

### Data Quality
- Current database health: 92.3% (72/78 formulas well-balanced)
- INCI coverage: 60.2% (339/563 ingredients)
- Review formulas with `total_percentage` outside 95-105% range

## Development Guidelines

1. **Test First**: Always use dry-run mode for testing
2. **Small Batches**: Sync in batches of 10-20 items to avoid rate limits
3. **Error Handling**: Include proper error handling for API failures
4. **Logging**: Log all operations for debugging
5. **Backup Safety**: Create backups before major changes