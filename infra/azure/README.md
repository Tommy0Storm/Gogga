# GOGGA Azure Deployment Guide

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Azure Container Apps                      │
│  ┌─────────────────────────┬─────────────────────────────┐  │
│  │     GOGGA Backend       │       CePO Sidecar          │  │
│  │     (FastAPI)           │       (OptiLLM)             │  │
│  │     Port 8000           │       Port 8080             │  │
│  │                         │                             │  │
│  │  • Llama 3.1 8B         │  • Chain-of-thought         │  │
│  │  • Qwen 3 235B          │  • Planning optimization    │  │
│  │  • PayFast integration  │  • No GPU required!         │  │
│  └────────────┬────────────┴──────────────┬──────────────┘  │
│               │                           │                  │
└───────────────┼───────────────────────────┼──────────────────┘
                │                           │
    ┌───────────▼───────────┐   ┌───────────▼───────────┐
    │    Azure SQL DB       │   │    Cerebras Cloud     │
    │  (Users, Payments)    │   │    (GPU Inference)    │
    └───────────────────────┘   └───────────────────────┘
```

## Prerequisites

1. **Azure CLI** installed: https://docs.microsoft.com/cli/azure/install-azure-cli
2. **Azure subscription** with Container Apps enabled
3. **Cerebras API Key** from https://cloud.cerebras.ai

## Deployment Steps

### 1. Login to Azure

```bash
az login
az account set --subscription "Your Subscription Name"
```

### 2. Deploy Infrastructure

```bash
cd infra/azure
chmod +x deploy.sh
./deploy.sh
```

This creates:
- **Container Apps Environment** - Managed Kubernetes for containers
- **GOGGA Backend** - FastAPI with CePO sidecar
- **GOGGA Frontend** - Next.js static site
- **Azure SQL** - User data and payment records
- **Redis Cache** - Session and rate limiting

### 3. Set up GitHub Actions (CI/CD)

Add these secrets to your GitHub repository:

| Secret | Description |
|--------|-------------|
| `AZURE_CREDENTIALS` | Service principal JSON |
| `BACKEND_URL` | Backend container app URL |

Create service principal:
```bash
az ad sp create-for-rbac --name "gogga-github-actions" \
  --role contributor \
  --scopes /subscriptions/<SUB_ID>/resourceGroups/gogga-rg \
  --json-auth
```

### 4. Push to Deploy

```bash
git add .
git commit -m "Deploy to Azure"
git push origin main
```

## Cost Estimation (South Africa North)

| Resource | SKU | Monthly Cost (ZAR) |
|----------|-----|-------------------|
| Container Apps (Backend) | 0.5 vCPU, 1GB | ~R150 |
| Container Apps (Frontend) | 0.25 vCPU, 512MB | ~R75 |
| Container Apps (CePO Sidecar) | 0.25 vCPU, 512MB | ~R75 |
| Azure SQL | Basic (5 DTU) | ~R100 |
| Redis Cache | Basic C0 | ~R250 |
| **Total** | | **~R650/month** |

*Note: Container Apps scale to zero when idle, so dev costs can be much lower.*

## Monitoring

```bash
# View backend logs
az containerapp logs show -n gogga-dev-backend -g gogga-rg --follow

# View CePO sidecar logs
az containerapp exec -n gogga-dev-backend -g gogga-rg --container cepo-sidecar

# Check revision status
az containerapp revision list -n gogga-dev-backend -g gogga-rg -o table
```

## Scaling

The backend auto-scales based on HTTP requests:
- **Min replicas**: 0 (scales to zero when idle)
- **Max replicas**: 10
- **Scale trigger**: 50 concurrent requests

Adjust in `main.bicep`:
```bicep
scale: {
  minReplicas: 1  // Keep at least 1 running
  maxReplicas: 20 // Handle more traffic
}
```

## Security Notes

1. **Secrets** are stored in Azure Container Apps secrets (encrypted at rest)
2. **SQL** requires Azure service firewall rule only
3. **Redis** uses TLS 1.2 minimum
4. **CePO sidecar** only accessible via localhost (internal to pod)
