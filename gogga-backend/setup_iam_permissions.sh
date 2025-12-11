#!/bin/bash

# Vertex AI IAM Permission Setup Script
# Project: general-dev-480621 (Project Number: 136969034568)
# Service Account: vertex-express@general-dev-480621.iam.gserviceaccount.com

echo "🔐 Vertex AI IAM Permission Setup"
echo "=================================="
echo ""
echo "⚠️  This script requires OWNER or Project IAM Admin permissions"
echo "   Current service account cannot grant its own permissions"
echo "   You need to run these commands as a user with admin access"
echo ""

PROJECT_ID="general-dev-480621"
PROJECT_NUMBER="136969034568"
SERVICE_ACCOUNT="vertex-express@${PROJECT_ID}.iam.gserviceaccount.com"
VERTEX_SERVICE_AGENT="service-${PROJECT_NUMBER}@gcp-sa-aiplatform.iam.gserviceaccount.com"

echo "📋 Project Details:"
echo "   Project ID: $PROJECT_ID"
echo "   Project Number: $PROJECT_NUMBER"
echo "   Service Account: $SERVICE_ACCOUNT"
echo "   Vertex AI Service Agent: $VERTEX_SERVICE_AGENT"
echo ""

# Authenticate as user (not service account)
echo "=" 
echo "STEP 1: Authenticate as Project Owner/Admin"
echo "=" 
echo ""
echo "Run this command in a separate terminal (NOT as service account):"
echo ""
echo "  gcloud auth login"
echo "  gcloud config set project $PROJECT_ID"
echo ""
echo "Press ENTER when ready to continue..."
read

# Grant roles to service account
echo ""
echo "=" 
echo "STEP 2: Grant IAM Roles to Service Account"
echo "=" 
echo ""

ROLES=(
    "roles/aiplatform.user"
    "roles/aiplatform.serviceAgent"
    "roles/serviceusage.serviceUsageConsumer"
    "roles/cloudresourcemanager.projectViewer"
)

for ROLE in "${ROLES[@]}"; do
    echo "📝 Granting $ROLE..."
    CMD="gcloud projects add-iam-policy-binding $PROJECT_ID --member=\"serviceAccount:$SERVICE_ACCOUNT\" --role=\"$ROLE\" --condition=None"
    echo "   Command: $CMD"
    echo ""
done

echo "Copy and run these commands:"
echo ""
for ROLE in "${ROLES[@]}"; do
    echo "gcloud projects add-iam-policy-binding $PROJECT_ID \\"
    echo "  --member=\"serviceAccount:$SERVICE_ACCOUNT\" \\"
    echo "  --role=\"$ROLE\""
    echo ""
done

# Enable required APIs
echo ""
echo "=" 
echo "STEP 3: Enable Required APIs"
echo "=" 
echo ""

APIS=(
    "aiplatform.googleapis.com"
    "cloudresourcemanager.googleapis.com"
    "serviceusage.googleapis.com"
)

echo "Copy and run these commands:"
echo ""
for API in "${APIS[@]}"; do
    echo "gcloud services enable $API --project=$PROJECT_ID"
done

echo ""
echo ""
echo "=" 
echo "STEP 4: Grant Permissions to Vertex AI Service Agent"
echo "=" 
echo ""
echo "If using Secret Manager for API keys:"
echo ""
echo "gcloud projects add-iam-policy-binding $PROJECT_ID \\"
echo "  --member=\"serviceAccount:$VERTEX_SERVICE_AGENT\" \\"
echo "  --role=\"roles/secretmanager.secretAccessor\""
echo ""

# Verify setup
echo ""
echo "=" 
echo "STEP 5: Verify Setup"
echo "=" 
echo ""
echo "After running the above commands, verify with:"
echo ""
echo "gcloud projects get-iam-policy $PROJECT_ID \\"
echo "  --flatten=\"bindings[].members\" \\"
echo "  --filter=\"bindings.members:$SERVICE_ACCOUNT\""
echo ""

# Test access
echo ""
echo "=" 
echo "STEP 6: Test Vertex AI Access"
echo "=" 
echo ""
echo "Wait 1-2 minutes for permissions to propagate, then run:"
echo ""
echo "  cd /home/ubuntu/Dev-Projects/Gogga/gogga-backend"
echo "  ./venv_vertex/bin/python test_known_models.py"
echo ""

echo "=" 
echo "✅ Setup Guide Complete"
echo "=" 
echo ""
echo "📋 Summary of Required Actions:"
echo "   1. Authenticate as project owner/admin (not service account)"
echo "   2. Grant 4 IAM roles to vertex-express service account"
echo "   3. Enable 3 required APIs"
echo "   4. Wait 1-2 minutes for propagation"
echo "   5. Test with Python script"
echo ""
echo "⚠️  IMPORTANT: These commands must be run by a user with"
echo "   Owner or Project IAM Admin role, not the service account"
