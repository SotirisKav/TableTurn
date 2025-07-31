# AICHMI Azure Deployment Guide

This guide walks you through deploying the AICHMI application to Microsoft Azure using a professional, secure, and cost-effective setup.

## 🏗️ Architecture Overview

- **Azure App Service (F1)**: Free tier hosting for the Node.js application
- **PostgreSQL Flexible Server (B1ms)**: Managed database with pgvector extension
- **GitHub Actions**: Automated CI/CD pipeline
- **Basic Security**: IP restrictions and optional HTTP Basic Auth

## 📋 Prerequisites

### Required Tools
- [Azure CLI](https://docs.microsoft.com/en-us/cli/azure/install-azure-cli) installed and configured
- [Node.js 18+](https://nodejs.org/) installed
- [PostgreSQL client](https://www.postgresql.org/download/) (psql) for database setup
- Git repository with GitHub Actions enabled

### Required Accounts
- Microsoft Azure account with subscription
- GitHub account with repository access
- Google Cloud account (for Gemini API)
- Stripe account (for payments)

## 🚀 Quick Start Deployment

### 1. Infrastructure Deployment
```bash
# Clone and navigate to project
git clone <your-repo>
cd aichmi

# Switch to deployment branch
git checkout 5-cloud-deployment

# Run infrastructure deployment
cd infrastructure
./deploy.sh
```

### 2. Database Setup
```bash
# Setup database schema and sample data
cd ../scripts
./setup-database.sh
```

### 3. Configure GitHub Actions
Add these secrets to your GitHub repository (`Settings > Secrets and variables > Actions`):

```
AZURE_WEBAPP_PUBLISH_PROFILE=<download from Azure portal>
AZURE_RESOURCE_GROUP=rg-aichmi-prod
DATABASE_URL=postgresql://aichmi_admin:password@psql-aichmi.postgres.database.azure.com:5432/aichmi?sslmode=require
GEMINI_API_KEY=<your-gemini-api-key>
JWT_SECRET=<generate-random-string>
GOOGLE_MAPS_API_KEY=<your-google-maps-key>
STRIPE_PUBLISHABLE_KEY=<your-stripe-publishable-key>
STRIPE_SECRET_KEY=<your-stripe-secret-key>
GOOGLE_CLIENT_ID=<your-google-oauth-client-id>
GOOGLE_CLIENT_SECRET=<your-google-oauth-client-secret>
BASIC_AUTH_USERNAME=<choose-username>
BASIC_AUTH_PASSWORD=<choose-password>
```

### 4. Deploy Application
```bash
# Push to main branch to trigger auto-deployment
git push origin main

# OR deploy manually
cd ../scripts
./deploy-app.sh
```

## 🔧 Detailed Setup Instructions

### Infrastructure Configuration

#### 1. Update Parameters
Before deploying, update your IP address and other parameters:
```bash
cd scripts
./update-parameters.sh
```

#### 2. Manual Infrastructure Deployment
If you prefer manual control:
```bash
# Login to Azure
az login

# Create resource group
az group create --name rg-aichmi-prod --location "East US"

# Deploy infrastructure
cd infrastructure
az deployment group create \
  --resource-group rg-aichmi-prod \
  --template-file main.bicep \
  --parameters @parameters.json
```

### Security Configuration

#### IP Restrictions
The Bicep template automatically configures IP restrictions to allow only your IP address. To update:

1. Run `./scripts/update-parameters.sh` to update your IP
2. Redeploy infrastructure: `./infrastructure/deploy.sh`

#### Basic Authentication
Enable basic auth protection during development:

1. Set environment variables in Azure App Service:
   ```
   BASIC_AUTH_ENABLED=true
   BASIC_AUTH_USERNAME=your-username
   BASIC_AUTH_PASSWORD=your-secure-password
   ```

2. Or disable by setting `BASIC_AUTH_ENABLED=false`

### Database Configuration

#### Initial Setup
```bash
# Run the database setup script
cd scripts
./setup-database.sh
```

#### Manual Database Setup
If you prefer manual setup:
```bash
# Connect to database
psql "postgresql://aichmi_admin:password@psql-aichmi.postgres.database.azure.com:5432/aichmi?sslmode=require"

# Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

# Run schema and data scripts
\i ../aichmi_db/aichmi_ddl.sql
\i ../aichmi_db/sample_data.sql
```

### Environment Variables

#### Required Variables
Copy `.env.template` to `.env` and configure:

```bash
cd aichmi_backend
cp .env.template .env
# Edit .env with your actual values
```

#### Azure App Service Configuration
Set these in the Azure portal or via CLI:
```bash
az webapp config appsettings set \
  --resource-group rg-aichmi-prod \
  --name aichmi-app \
  --settings \
    NODE_ENV=production \
    DATABASE_URL="your-database-url" \
    GEMINI_API_KEY="your-api-key" \
    # ... other variables
```

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow
The `.github/workflows/deploy.yml` automatically:

1. **Builds** the React frontend
2. **Installs** backend dependencies
3. **Packages** the application
4. **Deploys** to Azure App Service
5. **Configures** environment variables

### Manual Deployment
For quick testing or troubleshooting:
```bash
cd scripts
./deploy-app.sh
```

## 🔍 Monitoring and Troubleshooting

### Health Check
Your application includes a health endpoint:
```bash
curl https://aichmi-app.azurewebsites.net/api/health
```

### Log Monitoring
View logs in Azure portal or via CLI:
```bash
az webapp log tail --resource-group rg-aichmi-prod --name aichmi-app
```

### Common Issues

#### Database Connection Issues
1. Check firewall rules in Azure portal
2. Verify connection string format
3. Ensure pgvector extension is enabled

#### Deployment Failures
1. Check GitHub Actions logs
2. Verify all secrets are configured
3. Check Azure App Service logs

#### IP Access Denied
1. Update IP address: `./scripts/update-parameters.sh`
2. Redeploy infrastructure
3. Or temporarily disable IP restrictions in Azure portal

## 💰 Cost Optimization

### Current Costs (Monthly)
- App Service F1: **$0** (Free tier)
- PostgreSQL B1ms: **~$12** (Burstable performance)
- **Total: ~$12/month**

### Cost Reduction Tips
1. Use shared database for multiple projects
2. Scale down during off-hours (manual)
3. Monitor usage with Azure Cost Management

## 🔐 Security Best Practices

### Development Phase
- ✅ IP restrictions enabled
- ✅ Basic HTTP auth (optional)
- ✅ HTTPS only
- ✅ Helmet.js security headers

### Production Readiness
- [ ] Remove IP restrictions
- [ ] Implement proper authentication
- [ ] Add monitoring/alerting
- [ ] Setup custom domain with SSL

## 📈 Scaling Considerations

### Immediate Upgrades (When Needed)
1. **App Service**: F1 → B1 ($13/month)
2. **Database**: B1ms → B2s ($24/month)
3. **Add CDN**: Azure CDN for static assets

### Advanced Features
1. **Staging Environment**: Duplicate infrastructure
2. **Load Balancing**: Multiple App Service instances
3. **Caching**: Redis Cache for sessions
4. **Monitoring**: Application Insights

## 🛠️ Maintenance

### Regular Tasks
1. **Update IP Address**: Run `./scripts/update-parameters.sh` when your IP changes
2. **Monitor Costs**: Check Azure Cost Management monthly
3. **Update Dependencies**: Keep packages current
4. **Backup Database**: Regular automated backups are enabled

### Emergency Procedures
1. **Rollback Deployment**: Use Azure portal to swap deployment slots
2. **Database Recovery**: Point-in-time recovery available (7 days)
3. **Access Issues**: Disable IP restrictions temporarily via Azure portal

## 📞 Support

### Azure Resources
- Resource Group: `rg-aichmi-prod`
- App Service: `aichmi-app`
- Database: `psql-aichmi`

### Useful Commands
```bash
# Check deployment status
az webapp show --resource-group rg-aichmi-prod --name aichmi-app

# Restart app service
az webapp restart --resource-group rg-aichmi-prod --name aichmi-app

# Update environment variables
az webapp config appsettings set --resource-group rg-aichmi-prod --name aichmi-app --settings KEY=value
```

---

🎉 **Your AICHMI application is now deployed to Azure with professional security and monitoring!**