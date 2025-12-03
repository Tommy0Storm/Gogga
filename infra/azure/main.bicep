// GOGGA Azure Infrastructure
// Deploys: Container Apps Environment, Backend + CePO Sidecar, Azure SQL, Redis Cache

@description('Environment name (dev, staging, prod)')
param environment string = 'dev'

@description('Azure region for resources')
param location string = resourceGroup().location

@description('Cerebras API Key')
@secure()
param cerebrasApiKey string

@description('PayFast Merchant ID')
param payfastMerchantId string = ''

@description('PayFast Merchant Key')
@secure()
param payfastMerchantKey string = ''

@description('SQL Admin Password')
@secure()
param sqlAdminPassword string

// Variables
var prefix = 'gogga-${environment}'
var tags = {
  project: 'gogga'
  environment: environment
}

// Log Analytics Workspace (required for Container Apps)
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: '${prefix}-logs'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

// Container Apps Environment
resource containerAppsEnv 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: '${prefix}-env'
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
  }
}

// Azure SQL Server
resource sqlServer 'Microsoft.Sql/servers@2022-05-01-preview' = {
  name: '${prefix}-sql'
  location: location
  tags: tags
  properties: {
    administratorLogin: 'goggaadmin'
    administratorLoginPassword: sqlAdminPassword
    version: '12.0'
    minimalTlsVersion: '1.2'
  }
}

// Azure SQL Database
resource sqlDatabase 'Microsoft.Sql/servers/databases@2022-05-01-preview' = {
  parent: sqlServer
  name: 'gogga'
  location: location
  tags: tags
  sku: {
    name: 'Basic'
    tier: 'Basic'
    capacity: 5
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: 2147483648 // 2GB
  }
}

// Allow Azure services to access SQL
resource sqlFirewallRule 'Microsoft.Sql/servers/firewallRules@2022-05-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// Redis Cache (for session/rate limiting)
resource redisCache 'Microsoft.Cache/redis@2023-04-01' = {
  name: '${prefix}-redis'
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'Basic'
      family: 'C'
      capacity: 0
    }
    enableNonSslPort: false
    minimumTlsVersion: '1.2'
  }
}

// GOGGA Backend Container App (with CePO sidecar)
resource goggaBackend 'Microsoft.App/containerApps@2023-05-01' = {
  name: '${prefix}-backend'
  location: location
  tags: tags
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 8000
        transport: 'http'
        corsPolicy: {
          allowedOrigins: ['*']
          allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
          allowedHeaders: ['*']
        }
      }
      secrets: [
        {
          name: 'cerebras-api-key'
          value: cerebrasApiKey
        }
        {
          name: 'payfast-merchant-key'
          value: payfastMerchantKey
        }
        {
          name: 'sql-connection-string'
          value: 'Server=tcp:${sqlServer.properties.fullyQualifiedDomainName},1433;Database=gogga;User ID=goggaadmin;Password=${sqlAdminPassword};Encrypt=True;TrustServerCertificate=False;'
        }
        {
          name: 'redis-connection-string'
          value: '${redisCache.properties.hostName}:6380,password=${redisCache.listKeys().primaryKey},ssl=True,abortConnect=False'
        }
      ]
    }
    template: {
      containers: [
        // Main GOGGA Backend
        {
          name: 'gogga-backend'
          image: 'ghcr.io/tommy0storm/gogga-backend:latest'
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          env: [
            { name: 'ENVIRONMENT', value: environment }
            { name: 'CEREBRAS_API_KEY', secretRef: 'cerebras-api-key' }
            { name: 'MODEL_SPEED', value: 'llama3.1-8b' }
            { name: 'MODEL_COMPLEX', value: 'qwen-3-235b-a22b-instruct-2507' }
            { name: 'CEPO_ENABLED', value: 'true' }
            { name: 'CEPO_URL', value: 'http://localhost:8080' }
            { name: 'PAYFAST_MERCHANT_ID', value: payfastMerchantId }
            { name: 'PAYFAST_MERCHANT_KEY', secretRef: 'payfast-merchant-key' }
            { name: 'DATABASE_URL', secretRef: 'sql-connection-string' }
            { name: 'REDIS_URL', secretRef: 'redis-connection-string' }
          ]
        }
        // CePO Sidecar (OptiLLM)
        {
          name: 'cepo-sidecar'
          image: 'optillm/optillm:latest'
          resources: {
            cpu: json('0.25')
            memory: '512Mi'
          }
          args: ['--approach', 'cepo', '--port', '8080']
          env: [
            { name: 'CEREBRAS_API_KEY', secretRef: 'cerebras-api-key' }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 10
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

// GOGGA Frontend Container App
resource goggaFrontend 'Microsoft.App/containerApps@2023-05-01' = {
  name: '${prefix}-frontend'
  location: location
  tags: tags
  properties: {
    managedEnvironmentId: containerAppsEnv.id
    configuration: {
      ingress: {
        external: true
        targetPort: 3000
        transport: 'http'
      }
    }
    template: {
      containers: [
        {
          name: 'gogga-frontend'
          image: 'ghcr.io/tommy0storm/gogga-frontend:latest'
          resources: {
            cpu: json('0.25')
            memory: '512Mi'
          }
          env: [
            { name: 'NEXT_PUBLIC_API_URL', value: 'https://${goggaBackend.properties.configuration.ingress.fqdn}' }
          ]
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 5
      }
    }
  }
}

// Outputs
output backendUrl string = 'https://${goggaBackend.properties.configuration.ingress.fqdn}'
output frontendUrl string = 'https://${goggaFrontend.properties.configuration.ingress.fqdn}'
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
