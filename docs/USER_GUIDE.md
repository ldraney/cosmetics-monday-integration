# User Guide: Cosmetics Monday.com Integration Platform

## 🚀 Getting Started

This platform transforms your cosmetics formula management into a powerful Monday.com workspace with real-time pricing, compliance tracking, and supply chain intelligence.

## 📋 Quick Start Checklist

### **Initial Setup**
- [ ] Ensure PostgreSQL database is running
- [ ] Configure `.env` with Monday API token
- [ ] Run `npm install` to install dependencies
- [ ] Test connection with `node debug-monday-api.js`

### **First-Time Sync**
- [ ] Sync all ingredients: `node sync-all-ingredients.js --dry-run` (preview first)
- [ ] Upload pricing data: `node upload-remaining-pricing.js`
- [ ] Connect INCI data: `node connect-ingredients-inci.js --max-ingredients 20`
- [ ] Calculate formula costs: `node calculate-formula-costs.js --max-formulas 10`

## 🎯 Daily Workflows

### **Formula Cost Analysis**
1. **Check current pricing coverage**:
   ```bash
   node check-pricing-status.js
   ```

2. **Update formula costs**:
   ```bash
   node calculate-formula-costs.js --max-formulas 5
   ```

3. **Review cost changes** in Monday Formulas board

### **Ingredient Management**
1. **Monitor board health**:
   ```bash
   node board-status-monitor.js
   ```

2. **Add new ingredients** (when formulas are updated):
   ```bash
   node sync-all-ingredients.js --dry-run  # Preview new items
   node sync-all-ingredients.js            # Sync if satisfied
   ```

3. **Update INCI connections**:
   ```bash
   node connect-ingredients-inci.js --max-ingredients 10
   ```

### **Pricing Updates**
1. **When inFlow inventory is updated**:
   ```bash
   node upload-remaining-pricing.js
   ```

2. **Verify pricing coverage**:
   ```bash
   node check-pricing-status.js
   ```

3. **Recalculate all formula costs**:
   ```bash
   node calculate-formula-costs.js --max-formulas 20
   ```

## 📊 Understanding Your Monday Boards

### **🧬 INCI Master Database**
**Purpose**: Regulatory compliance and ingredient naming standards

**What you'll see**:
- Official INCI names for cosmetic ingredients
- Compliance documentation
- Links to ingredients that use each INCI name

**How to use**:
- Reference for product labeling
- Regulatory submission documentation
- Verify ingredient naming compliance

### **🧪 Ingredients Master Database**
**Purpose**: Complete ingredient catalog with pricing and supplier data

**Key columns**:
- **Name**: Your internal ingredient name
- **Price per KG**: Current cost from inFlow inventory
- **INCI Names**: Regulatory information and usage details

**How to use**:
- Cost planning for new formulas
- Ingredient substitution analysis
- Supplier performance tracking (when vendors board is connected)

### **🧪 Cosmetics Formulas**
**Purpose**: Formula management with automatic cost calculations

**Key columns**:
- **Name**: Formula identifier
- **Total Cost per KG**: Auto-calculated from ingredient costs
- **Formula Notes**: Detailed ingredient breakdown with percentages
- **Formula Status**: Development stage tracking
- **Connected Ingredients**: Links to ingredient dependencies

**How to use**:
- Product development cost tracking
- Formula optimization for cost efficiency
- Production planning and pricing decisions

### **💰 Ingredient Pricing Analysis**
**Purpose**: Cost optimization and vendor comparison

**How to use**:
- Identify high-cost ingredients for negotiation
- Track pricing trends over time
- Plan bulk purchasing strategies

## 🔧 Troubleshooting Common Issues

### **"No items found" in Monday boards**
**Cause**: Sync hasn't run or API permissions issue
**Solution**:
1. Check API connectivity: `node debug-monday-api.js`
2. Run initial sync: `node sync-all-ingredients.js`
3. Verify board permissions in Monday.com

### **Cost calculations showing $0.00**
**Cause**: No pricing data for ingredients
**Solution**:
1. Upload pricing: `node upload-remaining-pricing.js`
2. Check coverage: `node check-pricing-status.js`
3. Recalculate costs: `node calculate-formula-costs.js`

### **"Rate limit exceeded" errors**
**Cause**: Too many API calls too quickly
**Solution**:
- Scripts include built-in rate limiting
- Reduce batch sizes with `--batch-size 5`
- Wait 5 minutes between large operations

### **Database connection errors**
**Cause**: PostgreSQL not running or connection issues
**Solution**:
1. Check if PostgreSQL is running: `brew services list | grep postgres`
2. Start if needed: `brew services start postgresql`
3. Test connection: `psql -h localhost -p 5432 -U earthharbor -d cosmetics_data_hub_v2_local`

## 📈 Advanced Features

### **Scenario Modeling**
Use dry-run mode to preview changes:
```bash
node calculate-formula-costs.js --dry-run --max-formulas 10
```

### **Batch Operations**
Process data in manageable chunks:
```bash
node sync-all-ingredients.js --batch-size 10 --start-from 100
```

### **Data Quality Monitoring**
Regular health checks:
```bash
node check-missing-data.js  # Identifies sync gaps
node board-status-monitor.js  # Overall board health
```

## 🎯 Best Practices

### **Data Management**
1. **Run dry-runs first** - Always preview changes before committing
2. **Monitor pricing coverage** - Aim for >90% ingredient pricing
3. **Regular health checks** - Weekly board status monitoring
4. **Backup before major changes** - Use database backup tools

### **Cost Analysis**
1. **Focus on high-usage ingredients** - Prioritize pricing accuracy for frequently used items
2. **Track cost trends** - Monitor formula costs over time
3. **Validate outliers** - Review unusually high/low ingredient costs
4. **Consider alternatives** - Use cost data to guide ingredient substitution

### **Collaboration**
1. **Use Monday comments** - Collaborate directly in boards
2. **Status tracking** - Keep formula development stages updated
3. **Share insights** - Use Monday's sharing features for reports
4. **Team training** - Ensure team understands how to read cost data

## 🔮 Coming Soon

### **Vendor Integration**
- Connect ingredients to supplier information
- Multi-vendor pricing comparison
- Supply chain risk analysis

### **Advanced Analytics**
- Cost trend forecasting
- Automated optimization recommendations
- Market price intelligence

### **Production Integration**
- Link to inventory management
- Production cost tracking
- Batch cost analysis

## 🆘 Getting Help

### **For Technical Issues**
1. Check logs in terminal output
2. Review error messages in `board-health-report.json`
3. Test API connectivity with `node debug-monday-api.js`

### **For Data Questions**
1. Use `node check-missing-data.js` to identify gaps
2. Review pricing methodology in `docs/PRICING_ANALYSIS.md`
3. Check board structure with `node check-board-structure.js`

### **For Business Questions**
1. Review cost analysis in Monday Formulas board
2. Check pricing coverage with `node check-pricing-status.js`
3. Consult `docs/WHY_MONDAY_APPROACH.md` for strategic context

## 🎉 Success Tips

1. **Start small** - Begin with a few formulas and expand gradually
2. **Verify data** - Cross-check important costs with known suppliers
3. **Involve the team** - Train colleagues on reading Monday boards
4. **Plan regular updates** - Schedule weekly pricing and cost updates
5. **Monitor performance** - Track how the system improves decision-making

With this platform, you'll transform cosmetics formula management from manual spreadsheets into a **dynamic business intelligence system** that drives better decisions, lower costs, and faster innovation.