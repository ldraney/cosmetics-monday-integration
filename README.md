# Cosmetics Monday.com Integration

This project syncs cosmetics formula and ingredient data from your local PostgreSQL database to Monday.com boards for project management and pricing analysis.

## Purpose

- **Local Data Management**: Use the cleaned cosmetics database locally
- **Monday.com Integration**: Sync data to Monday boards for collaboration
- **Pricing Analysis**: Create ingredient cost analysis boards
- **Project Management**: Track formula development in Monday.com

## Prerequisites

1. **Source Database**: Access to the cosmetics database from `cosmetics-data-hub-v2-standalone`
2. **Monday.com Account**: With API access
3. **Node.js**: Version 20+ installed

## Quick Setup

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env with your credentials
nano .env

# Test connection
npm run sync -- --dry-run
```

## Data Sources

This project can pull data from:

### 1. Local PostgreSQL Database
- **Database**: `cosmetics_data_hub_v2_local`
- **Location**: `localhost:5432`
- **Contains**: 78 formulas, 563 ingredients, 1057 relationships
- **INCI Coverage**: 60.2% (339 ingredients with INCI names)

### 2. Exported JSON Files
- **File**: `../cosmetics-data-hub-v2-standalone/prod-data-export-2025-07-19.json`
- **Backup**: `../cosmetics-data-hub-v2-standalone/cosmetics_database_backup_20250718_193234.sql`

### 3. Original Excel Source
- **File**: `~/Downloads/Pure Earth Labs Finalized Formula.xlsx`
- **Contains**: 86 formula sheets with complete ingredient data

## Available Commands

### Sync Data to Monday.com
```bash
# Sync all formulas to Monday board
npm run sync

# Sync specific formulas only
npm run sync -- --filter "status=approved"

# Dry run (preview only)
npm run sync -- --dry-run
```

### Create Pricing Analysis
```bash
# Create ingredient pricing board
npm run pricing

# Include cost estimates
npm run pricing -- --with-estimates
```

### Database Operations
```bash
# Create local backup
npm run backup

# Restore from backup
npm run restore -- cosmetics_backup.sql

# Copy production data locally
npm run restore -- ../cosmetics-data-hub-v2-standalone/prod-data-export-2025-07-19.json
```

## Monday.com Board Structure

### Formula Board
- **Name**: Cosmetics Formulas Database
- **Columns**: 
  - Formula Name
  - Version
  - Status (Approved/Needs Review)
  - Total Percentage
  - Ingredient Count
  - Review Notes
  - Cost Estimate

### Pricing Board
- **Name**: Ingredient Pricing & Usage Analysis
- **Columns**:
  - Ingredient Name
  - INCI Name
  - Usage Count (# of formulas)
  - Average Percentage
  - Cost per KG
  - Supplier
  - Priority Level

## Configuration

### Environment Variables
```env
# Monday.com API
MONDAY_API_TOKEN=your_monday_api_token

# Database Connection
DATABASE_URL=postgres://username:password@localhost:5432/cosmetics_data_hub_v2_local

# Optional: Board IDs (auto-created if not provided)
FORMULAS_BOARD_ID=123456789
PRICING_BOARD_ID=987654321
```

### Getting Monday.com API Token
1. Go to https://monday.com/developers/v2
2. Create a new app or use existing
3. Generate API token with read/write permissions
4. Copy token to `.env` file

## Data Quality

### Database Health (Current)
- **Total Formulas**: 78
- **Well-balanced (95-105%)**: 72 (92.3%)
- **Average Percentage**: 98.49%
- **Total Ingredients**: 563
- **INCI Coverage**: 60.2%

### Formula Review Status
- **Approved**: 41 formulas
- **Needs Review**: 37 formulas
- **Common Issues**: Missing percentages, duplicate ingredients

## Troubleshooting

### Database Connection Issues
```bash
# Test local database
psql -h localhost -p 5432 -U earthharbor -d cosmetics_data_hub_v2_local -c "SELECT COUNT(*) FROM formulas;"

# Restore from backup if needed
npm run restore -- ../cosmetics-data-hub-v2-standalone/cosmetics_database_backup_20250718_193234.sql
```

### Monday.com API Issues
- Check API token has read/write permissions
- Verify board access permissions
- Rate limits: 10 requests per second

## File Structure

```
cosmetics-monday-integration/
├── README.md                 # This file
├── CLAUDE.md                # Claude Code instructions
├── package.json             # Dependencies and scripts
├── .env.example            # Environment template
├── sync-formulas.js        # Main sync script
├── create-pricing-board.js # Pricing analysis
├── backup-database.js      # Database backup
├── restore-database.js     # Database restore
└── lib/                    # Utilities
    ├── database.js         # DB connection
    ├── monday.js          # Monday.com API
    └── utils.js           # Helper functions
```

## Integration with Main Project

This project is designed to work alongside `cosmetics-data-hub-v2-standalone`:

1. **Data Source**: Reads from the main project's database
2. **Standalone**: Can run independently 
3. **No Interference**: Doesn't modify source data
4. **Backup Safe**: Creates backups before operations

## Next Steps

1. Run `npm install` to install dependencies
2. Set up `.env` with your Monday.com API token
3. Test with `npm run sync -- --dry-run`
4. Create your first Monday board with `npm run sync`
5. Add pricing analysis with `npm run pricing`