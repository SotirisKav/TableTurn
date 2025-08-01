@description('The location for all resources')
param location string = resourceGroup().location

@description('The name of the App Service app')
param appName string = 'tableturn-app'

@description('The name of the App Service plan')
param appServicePlanName string = 'asp-tableturn'

@description('The name of the PostgreSQL server')
param postgresServerName string = 'psql-tableturn'

@description('The administrator username for PostgreSQL')
param postgresAdminLogin string = 'tableturn_admin'

@description('The administrator password for PostgreSQL')
@secure()
param postgresAdminPassword string

@description('Your IP address for database access')
param myIpAddress string

// App Service Plan (F1 Free tier for Linux)
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: 'F1'
    tier: 'Free'
    size: 'F1'
    family: 'F'
    capacity: 1
  }
  properties: {
    // This must be true for Linux App Service Plans.
    reserved: true
  }
}

// App Service
resource appService 'Microsoft.Web/sites@2023-01-01' = {
  name: appName
  location: location
  properties: {
    serverFarmId: appServicePlan.id
    httpsOnly: true
    siteConfig: {
      // Use linuxFxVersion for Linux App Services.
      // Version is set to 18-lts to match the NODE_VERSION in the .github/workflows/deploy.yml file.
      linuxFxVersion: 'NODE|18-lts'
      appSettings: [
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '18-lts'
        }
        {
          name: 'NODE_ENV'
          value: 'production'
        }
        {
          name: 'PORT'
          value: '8080'
        }
        {
          // Your application uses a single DATABASE_URL, as shown in deploy.yml and setup-database.sh.
          name: 'DATABASE_URL'
          value: 'postgresql://${postgresAdminLogin}:${postgresAdminPassword}@${postgresServer.properties.fullyQualifiedDomainName}:5432/tableturn?sslmode=require'
        }
        // NOTE: Other secrets (GEMINI_API_KEY, JWT_SECRET, etc.) are set securely via the GitHub Actions workflow.
        // This is the correct pattern and prevents secrets from being stored in the infrastructure code.
      ]
      ipSecurityRestrictions: [
        {
          ipAddress: '${myIpAddress}/32'
          action: 'Allow'
          tag: 'Default'
          priority: 100
          name: 'DeveloperAccess'
          description: 'Allow access from developer IP'
        }
        {
          ipAddress: '0.0.0.0/0'
          action: 'Deny'
          tag: 'Default'
          priority: 200
          name: 'DenyAll'
          description: 'Deny all other traffic'
        }
      ]
    }
  }
}

// PostgreSQL Flexible Server
resource postgresServer 'Microsoft.DBforPostgreSQL/flexibleServers@2023-03-01-preview' = {
  name: postgresServerName
  location: location
  sku: {
    name: 'Standard_B1ms'
    tier: 'Burstable'
  }
  properties: {
    administratorLogin: postgresAdminLogin
    administratorLoginPassword: postgresAdminPassword
    version: '15'
    storage: {
      storageSizeGB: 32
      autoGrow: 'Enabled'
    }
    backup: {
      backupRetentionDays: 7
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
  }
}

// PostgreSQL Database
resource postgresDatabase 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2023-03-01-preview' = {
  parent: postgresServer
  name: 'tableturn'
  properties: {
    charset: 'utf8'
    collation: 'en_US.utf8'
  }
}

// PostgreSQL Configuration for pgvector extension
resource postgresConfig 'Microsoft.DBforPostgreSQL/flexibleServers/configurations@2023-03-01-preview' = {
  parent: postgresServer
  // Use 'azure.extensions' to enable extensions on Azure PostgreSQL.
  name: 'azure.extensions'
  properties: {
    // The required value to enable pgvector is 'VECTOR'.
    value: 'VECTOR'
    source: 'user-override'
  }
}

// Firewall rule for developer IP
resource postgresFirewallRule 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-03-01-preview' = {
  parent: postgresServer
  name: 'AllowDeveloperIP'
  properties: {
    startIpAddress: myIpAddress
    endIpAddress: myIpAddress
  }
}

// Firewall rule for Azure services
resource postgresFirewallRuleAzure 'Microsoft.DBforPostgreSQL/flexibleServers/firewallRules@2023-03-01-preview' = {
  parent: postgresServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Outputs
output appServiceUrl string = 'https://${appService.properties.defaultHostName}'
output postgresServerName string = postgresServer.properties.fullyQualifiedDomainName
output appServiceName string = appService.name
output resourceGroupName string = resourceGroup().name
