#!/bin/bash
# GOGGA Azure Deployment Script
# Deploys the complete infrastructure to Azure

set -e

# Configuration
RESOURCE_GROUP="${RESOURCE_GROUP:-gogga-rg}"
LOCATION="${LOCATION:-southafricanorth}"
ENVIRONMENT="${ENVIRONMENT:-dev}"

echo "🚀 GOGGA Azure Deployment"
echo "========================="
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo "Environment: $ENVIRONMENT"
echo ""

# Check Azure CLI is installed
if ! command -v az &> /dev/null; then
    echo "❌ Azure CLI not found. Install: https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# Check logged in
if ! az account show &> /dev/null; then
    echo "📝 Please login to Azure..."
    az login
fi

# Show current subscription
SUBSCRIPTION=$(az account show --query name -o tsv)
echo "✓ Using subscription: $SUBSCRIPTION"
echo ""

# Create resource group if it doesn't exist
echo "📦 Creating resource group..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --tags project=gogga environment="$ENVIRONMENT" -o none
echo "✓ Resource group ready"

# Prompt for secrets if not in environment
if [ -z "$CEREBRAS_API_KEY" ]; then
    read -sp "Enter Cerebras API Key: " CEREBRAS_API_KEY
    echo ""
fi

if [ -z "$SQL_ADMIN_PASSWORD" ]; then
    read -sp "Enter SQL Admin Password (min 8 chars, uppercase, lowercase, number): " SQL_ADMIN_PASSWORD
    echo ""
fi

# Deploy Bicep template
echo ""
echo "🏗️  Deploying infrastructure..."
az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-file main.bicep \
    --parameters environment="$ENVIRONMENT" \
    --parameters location="$LOCATION" \
    --parameters cerebrasApiKey="$CEREBRAS_API_KEY" \
    --parameters sqlAdminPassword="$SQL_ADMIN_PASSWORD" \
    --parameters payfastMerchantId="${PAYFAST_MERCHANT_ID:-10000100}" \
    --parameters payfastMerchantKey="${PAYFAST_MERCHANT_KEY:-}" \
    --query "properties.outputs" \
    -o json

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Build and push Docker images to GitHub Container Registry"
echo "2. Update the container image references in the Bicep file"
echo "3. Re-deploy to update the containers"
echo ""
echo "Useful commands:"
echo "  az containerapp logs show -n gogga-${ENVIRONMENT}-backend -g $RESOURCE_GROUP --follow"
echo "  az containerapp revision list -n gogga-${ENVIRONMENT}-backend -g $RESOURCE_GROUP"
