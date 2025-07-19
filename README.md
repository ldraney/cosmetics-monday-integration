# 🧪 Cosmetics Monday.com Integration Platform

**Transform your cosmetics formula management into a powerful Monday.com workspace with real-time pricing, compliance tracking, and supply chain intelligence.**

This project creates a sophisticated business intelligence platform by syncing cosmetics data from your local PostgreSQL database to interconnected Monday.com boards, providing automatic cost calculations, vendor management, and regulatory compliance tracking.

## 🎯 Why This Approach Is Awesome

- **💰 Real-time Cost Intelligence**: Automatic formula cost updates when ingredient prices change
- **🔗 Visual Dependency Mapping**: See exactly which formulas use which ingredients and suppliers
- **📊 Business Intelligence**: 81.9% pricing coverage with detailed cost analysis
- **🧬 Compliance Tracking**: Integrated INCI database for regulatory requirements
- **🤝 Collaborative Workflows**: Built-in team collaboration and approval processes
- **⚡ Instant Updates**: Changes propagate automatically across all connected boards

**Current Status**: 563 ingredients, 78 formulas, 1,057 relationships with $43.71/kg average formula cost

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

## 🚀 Available Commands

### Core Integration
```bash
# Sync all 563 ingredients to Monday board
node sync-all-ingredients.js [--dry-run] [--batch-size 10]

# Calculate real-time formula costs using Monday pricing
node calculate-formula-costs.js [--dry-run] [--max-formulas 10]

# Upload pricing data from inFlow inventory
node upload-remaining-pricing.js

# Connect ingredients to INCI compliance data
node connect-ingredients-inci.js [--max-ingredients 20]
```

### Monitoring & Analysis
```bash
# Check pricing coverage and gaps
node check-pricing-status.js

# Monitor board health and connections
node board-status-monitor.js

# Identify missing data and sync issues
node check-missing-data.js

# Test Monday API connectivity
node debug-monday-api.js
```

### Advanced Features
```bash
# Update formulas with detailed ingredient breakdowns
node update-formula-details.js [--max-formulas 10]

# Create dependency relationships (formulas → ingredients)
node connect-formula-ingredients.js [--dry-run]

# Analyze board structure and columns
node check-board-structure.js
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

## 📊 Monday.com Board Architecture (4-Tier Integration)

### 🧬 INCI Master Database (107+ items)
**Purpose**: Regulatory compliance and ingredient naming standards
- Official INCI names for cosmetic ingredients
- Compliance documentation and regulatory references
- Links to ingredients using each INCI name

### 🧪 Ingredients Master Database (563 items with 81.9% pricing)
**Purpose**: Complete ingredient catalog with cost intelligence
- **Name**: Internal ingredient identifiers
- **Price per KG**: Real-time pricing from inFlow inventory ($5.47 - $286.44/kg range)
- **INCI Names**: Regulatory compliance data with usage details
- **Usage Count**: Number of formulas using each ingredient
- **Ready for vendor connections**: Prepared for supplier board integration

### 🧪 Cosmetics Formulas (78 formulas with cost calculations)
**Purpose**: Formula management with automatic cost tracking
- **Formula Name & Version**: Product identifiers
- **Total Cost per KG**: Auto-calculated from ingredient pricing (avg $43.71/kg)
- **Formula Notes**: Detailed ingredient breakdown with percentages and cost contributors
- **Connected Ingredients**: Dependency relationships for full traceability
- **Formula Status**: Development stage tracking (Approved/Needs Review)
- **Total Percentage & Ingredient Count**: Quality assurance metrics

### 💰 Ingredient Pricing Analysis
**Purpose**: Cost optimization and market intelligence
- Pricing trend analysis and supplier comparison
- Cost optimization opportunities identification
- Market intelligence for negotiation leverage

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

## 🚀 Quick Start Guide

### 1. Initial Setup
```bash
npm install                           # Install dependencies
cp .env.example .env                 # Create environment file
# Edit .env with your Monday API token
node debug-monday-api.js             # Test connectivity
```

### 2. First-Time Sync
```bash
node sync-all-ingredients.js --dry-run    # Preview ingredient sync
node sync-all-ingredients.js              # Sync all 563 ingredients
node upload-remaining-pricing.js          # Upload inFlow pricing data
node connect-ingredients-inci.js --max-ingredients 20  # Add INCI data
```

### 3. Formula Cost Analysis
```bash
node calculate-formula-costs.js --dry-run --max-formulas 5  # Preview costs
node calculate-formula-costs.js --max-formulas 10         # Calculate real costs
node check-pricing-status.js                              # Verify coverage
```

### 4. Ongoing Monitoring
```bash
node board-status-monitor.js         # Check board health
node check-missing-data.js          # Identify sync gaps
```

## 📚 Documentation

- **[Why Monday Approach](docs/WHY_MONDAY_APPROACH.md)**: Strategic benefits and competitive advantages
- **[Pricing Analysis](docs/PRICING_ANALYSIS.md)**: Confidence levels and cost methodology  
- **[Vendor Integration Plan](docs/VENDOR_INTEGRATION_PLAN.md)**: Supply chain management roadmap
- **[User Guide](docs/USER_GUIDE.md)**: Daily workflows and troubleshooting

## 🎯 Next Phase: Vendor Integration

Ready to connect with your existing **Vendors Board** for complete supply chain intelligence:
- Link ingredients to supplier information
- Multi-vendor pricing comparison  
- Supply chain risk analysis
- Automated vendor performance tracking

See `docs/VENDOR_INTEGRATION_PLAN.md` for implementation details.