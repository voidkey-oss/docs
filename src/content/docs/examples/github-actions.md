---
title: GitHub Actions Example
description: Using Voidkey with GitHub Actions OIDC
---

This guide shows how to use Voidkey with GitHub Actions to securely access cloud resources without storing long-lived secrets.

## Overview

GitHub Actions provides OIDC tokens that can be used to authenticate with Voidkey. This eliminates the need to store cloud credentials as GitHub secrets.

## Prerequisites

1. Voidkey broker deployed and accessible
2. GitHub Actions OIDC configured as a client IdP
3. Appropriate identity mappings configured

## Configuration

### 1. Broker Configuration

Add GitHub Actions as a client IdP in your Voidkey configuration:

```yaml
clientIdps:
  - name: "github-actions"
    issuer: "https://token.actions.githubusercontent.com"
    # Use your GitHub organization or repository
    audience: "https://github.com/myorg"

clientIdentities:
  # Production deployments from main branch
  - subject: "repo:myorg/myapp:ref:refs/heads/main"
    idp: "github-actions"
    keys:
      AWS_PROD_DEPLOY:
        provider: "aws-prod"
        roleArn: "arn:aws:iam::123456789012:role/GitHubActionsProdDeploy"
        duration: 3600
        outputs:
          AWS_ACCESS_KEY_ID: "AccessKeyId"
          AWS_SECRET_ACCESS_KEY: "SecretAccessKey"
          AWS_SESSION_TOKEN: "SessionToken"
          AWS_REGION: "us-east-1"
  
  # Staging deployments from develop branch
  - subject: "repo:myorg/myapp:ref:refs/heads/develop"
    idp: "github-actions"
    keys:
      AWS_STAGING_DEPLOY:
        provider: "aws-staging"
        roleArn: "arn:aws:iam::123456789012:role/GitHubActionsStagingDeploy"
        duration: 1800
```

### 2. AWS IAM Trust Policy

Configure your AWS IAM role to trust the Voidkey broker:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::123456789012:oidc-provider/auth.voidkey.example.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "auth.voidkey.example.com:aud": "voidkey-broker",
          "auth.voidkey.example.com:sub": "broker-service"
        }
      }
    }
  ]
}
```

## GitHub Actions Workflows

### Basic Deployment Workflow

```yaml
name: Deploy to AWS

on:
  push:
    branches:
      - main

# Required for OIDC token
permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Configure Voidkey
        run: |
          # Install Voidkey CLI
          curl -L https://github.com/voidkey-oss/voidkey/releases/latest/download/voidkey-linux-amd64 -o voidkey
          chmod +x voidkey
          sudo mv voidkey /usr/local/bin/
      
      - name: Get GitHub OIDC token
        uses: actions/github-script@v7
        id: get-token
        with:
          script: |
            const token = await core.getIDToken('https://github.com/myorg')
            core.setOutput('token', token)
      
      - name: Mint AWS credentials
        run: |
          # Export credentials as environment variables
          eval "$(voidkey mint --keys AWS_PROD_DEPLOY)"
        env:
          VOIDKEY_BROKER_URL: ${{ vars.VOIDKEY_BROKER_URL }}
          VOIDKEY_OIDC_TOKEN: ${{ steps.get-token.outputs.token }}
      
      - name: Deploy to S3
        run: |
          aws s3 sync ./dist s3://my-production-bucket/
          aws cloudfront create-invalidation --distribution-id ${{ vars.CF_DIST_ID }} --paths "/*"
```

### Reusable Workflow

Create a reusable workflow for credential minting:

```yaml
# .github/workflows/voidkey-credentials.yml
name: Mint Voidkey Credentials

on:
  workflow_call:
    inputs:
      keys:
        required: true
        type: string
        description: 'Comma-separated list of keys to mint'
      audience:
        required: false
        type: string
        default: 'https://github.com/${{ github.repository_owner }}'
    outputs:
      credentials:
        description: 'JSON formatted credentials'
        value: ${{ jobs.mint.outputs.credentials }}

jobs:
  mint:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
    
    outputs:
      credentials: ${{ steps.mint.outputs.credentials }}
    
    steps:
      - name: Install Voidkey CLI
        run: |
          curl -L https://github.com/voidkey-oss/voidkey/releases/latest/download/voidkey-linux-amd64 -o voidkey
          chmod +x voidkey
          sudo mv voidkey /usr/local/bin/
      
      - name: Get GitHub OIDC token
        uses: actions/github-script@v7
        id: get-token
        with:
          script: |
            const token = await core.getIDToken('${{ inputs.audience }}')
            core.setOutput('token', token)
      
      - name: Mint credentials
        id: mint
        run: |
          # Get credentials in JSON format
          CREDS=$(voidkey mint --keys "${{ inputs.keys }}" --output json)
          
          # Set multi-line output
          echo "credentials<<EOF" >> $GITHUB_OUTPUT
          echo "$CREDS" >> $GITHUB_OUTPUT
          echo "EOF" >> $GITHUB_OUTPUT
          
          # Also export as environment variables for this job
          eval "$(voidkey mint --keys "${{ inputs.keys }}" --output env)"
        env:
          VOIDKEY_BROKER_URL: ${{ vars.VOIDKEY_BROKER_URL }}
          VOIDKEY_OIDC_TOKEN: ${{ steps.get-token.outputs.token }}
```

Use the reusable workflow:

```yaml
name: Deploy Application

on:
  push:
    branches: [main]

jobs:
  get-credentials:
    uses: ./.github/workflows/voidkey-credentials.yml
    with:
      keys: AWS_PROD_DEPLOY,DOCKER_REGISTRY
    permissions:
      id-token: write
  
  deploy:
    needs: get-credentials
    runs-on: ubuntu-latest
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Configure AWS credentials
        run: |
          # Parse JSON output from previous job
          echo '${{ needs.get-credentials.outputs.credentials }}' | jq -r '
            .AWS_PROD_DEPLOY | to_entries | .[] | "export \(.key)=\(.value)"
          ' > aws_creds.sh
          source aws_creds.sh
      
      - name: Build and push Docker image
        run: |
          # Parse Docker registry credentials
          echo '${{ needs.get-credentials.outputs.credentials }}' | jq -r '
            .DOCKER_REGISTRY | to_entries | .[] | "export \(.key)=\(.value)"
          ' > docker_creds.sh
          source docker_creds.sh
          
          docker build -t myapp:${{ github.sha }} .
          docker tag myapp:${{ github.sha }} $DOCKER_REGISTRY/myapp:latest
          docker push $DOCKER_REGISTRY/myapp:latest
```

### Multi-Environment Deployment

Deploy to different environments based on branch:

```yaml
name: Multi-Environment Deploy

on:
  push:
    branches:
      - main
      - develop
      - 'release/*'

permissions:
  id-token: write
  contents: read

jobs:
  determine-environment:
    runs-on: ubuntu-latest
    outputs:
      environment: ${{ steps.set-env.outputs.environment }}
      keys: ${{ steps.set-env.outputs.keys }}
    
    steps:
      - name: Determine environment
        id: set-env
        run: |
          if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
            echo "environment=production" >> $GITHUB_OUTPUT
            echo "keys=AWS_PROD_DEPLOY" >> $GITHUB_OUTPUT
          elif [[ "${{ github.ref }}" == "refs/heads/develop" ]]; then
            echo "environment=staging" >> $GITHUB_OUTPUT
            echo "keys=AWS_STAGING_DEPLOY" >> $GITHUB_OUTPUT
          elif [[ "${{ github.ref }}" =~ ^refs/heads/release/.* ]]; then
            echo "environment=qa" >> $GITHUB_OUTPUT
            echo "keys=AWS_QA_DEPLOY" >> $GITHUB_OUTPUT
          fi
  
  deploy:
    needs: determine-environment
    runs-on: ubuntu-latest
    environment: ${{ needs.determine-environment.outputs.environment }}
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup Voidkey
        run: |
          curl -L https://github.com/voidkey-oss/voidkey/releases/latest/download/voidkey-linux-amd64 -o voidkey
          chmod +x voidkey
          sudo mv voidkey /usr/local/bin/
      
      - name: Get OIDC token
        uses: actions/github-script@v7
        id: get-token
        with:
          script: |
            const token = await core.getIDToken('https://github.com/${{ github.repository_owner }}')
            core.setOutput('token', token)
      
      - name: Mint credentials
        run: |
          eval "$(voidkey mint --keys ${{ needs.determine-environment.outputs.keys }})"
        env:
          VOIDKEY_BROKER_URL: ${{ vars.VOIDKEY_BROKER_URL }}
          VOIDKEY_OIDC_TOKEN: ${{ steps.get-token.outputs.token }}
      
      - name: Deploy
        run: |
          echo "Deploying to ${{ needs.determine-environment.outputs.environment }}"
          ./scripts/deploy.sh --environment ${{ needs.determine-environment.outputs.environment }}
```

## Advanced Patterns

### Matrix Deployments

Deploy to multiple regions using matrix strategy:

```yaml
name: Multi-Region Deploy

on:
  push:
    branches: [main]

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        region:
          - us-east-1
          - eu-west-1
          - ap-southeast-1
        include:
          - region: us-east-1
            keys: AWS_US_DEPLOY
          - region: eu-west-1
            keys: AWS_EU_DEPLOY
          - region: ap-southeast-1
            keys: AWS_APAC_DEPLOY
    
    steps:
      - name: Checkout
        uses: actions/checkout@v4
      
      - name: Setup and mint credentials
        run: |
          # Install CLI
          curl -L https://github.com/voidkey-oss/voidkey/releases/latest/download/voidkey-linux-amd64 -o voidkey
          chmod +x voidkey
          
          # Get token
          TOKEN=$(curl -s -H "Authorization: Bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
            "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=https://github.com/${{ github.repository_owner }}" | \
            jq -r '.value')
          
          # Mint credentials
          eval "$(./voidkey mint --token "$TOKEN" --keys ${{ matrix.keys }})"
        env:
          VOIDKEY_BROKER_URL: ${{ vars.VOIDKEY_BROKER_URL }}
      
      - name: Deploy to region
        run: |
          echo "Deploying to ${{ matrix.region }}"
          aws s3 sync ./dist s3://my-bucket-${{ matrix.region }}/ --region ${{ matrix.region }}
```

### Credential Caching

Cache credentials for multiple steps:

```yaml
- name: Mint and cache credentials
  id: creds
  run: |
    # Mint credentials
    CREDS_JSON=$(voidkey mint --keys AWS_DEPLOY,GCP_DEPLOY --output json)
    
    # Save to file for later steps
    echo "$CREDS_JSON" > /tmp/voidkey-creds.json
    
    # Extract specific values for outputs
    AWS_KEY=$(echo "$CREDS_JSON" | jq -r '.AWS_DEPLOY.AWS_ACCESS_KEY_ID')
    echo "::add-mask::$AWS_KEY"
    echo "aws_key=$AWS_KEY" >> $GITHUB_OUTPUT

- name: Use AWS credentials
  run: |
    # Load AWS credentials
    eval "$(jq -r '.AWS_DEPLOY | to_entries | .[] | "export \(.key)=\"\(.value)\""' < /tmp/voidkey-creds.json)"
    aws s3 ls

- name: Use GCP credentials
  run: |
    # Load GCP credentials
    eval "$(jq -r '.GCP_DEPLOY | to_entries | .[] | "export \(.key)=\"\(.value)\""' < /tmp/voidkey-creds.json)"
    gcloud storage ls
```

## Security Best Practices

### 1. Restrict Token Permissions

Always use minimal permissions:

```yaml
permissions:
  id-token: write    # Required for OIDC
  contents: read     # Only if needed
  # Don't add unnecessary permissions
```

### 2. Use Environment Protection

Configure environment protection rules:

```yaml
jobs:
  deploy:
    environment:
      name: production
      url: https://app.example.com
    # Requires approval for production deployments
```

### 3. Validate Subjects

Configure precise subject patterns:

```yaml
clientIdentities:
  # Good - specific branch
  - subject: "repo:myorg/myapp:ref:refs/heads/main"
  
  # Avoid - too broad
  - subject: "repo:myorg/myapp:ref:refs/heads/*"
```

### 4. Audit Token Claims

Log token claims for debugging:

```yaml
- name: Debug token claims
  if: ${{ vars.DEBUG_TOKENS == 'true' }}
  run: |
    voidkey validate --verbose
  env:
    VOIDKEY_OIDC_TOKEN: ${{ steps.get-token.outputs.token }}
```

## Troubleshooting

### Common Issues

**"Subject not found in configuration"**
- Check the exact subject format in token
- Ensure branch name matches configuration
- Verify repository name is correct

**"Invalid audience"**
- Match audience in workflow with broker config
- Use repository owner for org-wide access

**"Token expired"**
- OIDC tokens are short-lived (5-10 minutes)
- Mint credentials early in the workflow
- Don't cache tokens between jobs

### Debugging Workflow

```yaml
- name: Debug information
  run: |
    echo "Repository: ${{ github.repository }}"
    echo "Ref: ${{ github.ref }}"
    echo "Actor: ${{ github.actor }}"
    
    # Get token claims
    TOKEN=$(curl -s -H "Authorization: Bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
      "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=https://github.com/${{ github.repository_owner }}" | \
      jq -r '.value')
    
    # Decode token (base64)
    echo "Token claims:"
    echo $TOKEN | cut -d. -f2 | base64 -d | jq .
```

## Next Steps

- [CI/CD Examples](/examples/cicd/) - Other CI/CD platforms
- [Configuration Guide](/configuration/guide/) - Configure for your needs
- [Security Model](/architecture/security/) - Understand security implications
- [API Reference](/api/rest/) - Direct API integration