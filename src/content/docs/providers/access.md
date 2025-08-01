---
title: Access Providers
description: Available access providers for credential minting
---

This page details all access providers supported by Voidkey for minting temporary credentials.

## Overview

Access providers integrate with cloud services to mint temporary, scoped credentials. Each provider implements the common `AccessProvider` interface while handling provider-specific authentication and credential formats.

## AWS STS

AWS Security Token Service provides temporary credentials for AWS resources.

### Configuration

```yaml
accessProviders:
  - name: "aws-prod"
    type: "aws-sts"
    region: "us-east-1"
    
    # Optional configurations
    endpoint: "https://sts.amazonaws.com"
    externalId: "${AWS_EXTERNAL_ID}"
    maxDuration: 3600
    
    # Session tags
    tags:
      Environment: "production"
      ManagedBy: "voidkey"
```

### Key Configuration

```yaml
clientIdentities:
  - subject: "repo:myorg/myapp:ref:refs/heads/main"
    idp: "github-actions"
    keys:
      AWS_PROD_DEPLOY:
        provider: "aws-prod"
        roleArn: "arn:aws:iam::123456789012:role/DeploymentRole"
        duration: 3600
        sessionName: "github-${GITHUB_RUN_ID}"
        externalId: "custom-external-id"  # Override provider default
        
        # Custom session tags
        tags:
          Repository: "${repository}"
          Branch: "${ref}"
        
        # Output mapping
        outputs:
          AWS_ACCESS_KEY_ID: "AccessKeyId"
          AWS_SECRET_ACCESS_KEY: "SecretAccessKey"
          AWS_SESSION_TOKEN: "SessionToken"
          AWS_REGION: "us-east-1"
          AWS_DEFAULT_REGION: "us-east-1"
```

### IAM Role Trust Policy

Configure your AWS IAM role to trust the Voidkey broker:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Federated": "arn:aws:iam::ACCOUNT:oidc-provider/auth.voidkey.example.com"
      },
      "Action": "sts:AssumeRoleWithWebIdentity",
      "Condition": {
        "StringEquals": {
          "auth.voidkey.example.com:aud": "voidkey-broker",
          "auth.voidkey.example.com:sub": "broker-service"
        },
        "StringLike": {
          "auth.voidkey.example.com:token_use": "access"
        }
      }
    }
  ]
}
```

### Advanced Features

**Cross-Account Access:**
```yaml
AWS_CROSS_ACCOUNT:
  provider: "aws-prod"
  roleArn: "arn:aws:iam::987654321098:role/CrossAccountRole"
  externalId: "shared-external-id"
  duration: 1800
```

**Regional Endpoints:**
```yaml
accessProviders:
  - name: "aws-govcloud"
    type: "aws-sts"
    region: "us-gov-west-1"
    endpoint: "https://sts.us-gov-west-1.amazonaws.com"
```

**Session Policies:**
```yaml
AWS_LIMITED_ACCESS:
  provider: "aws-prod"
  roleArn: "arn:aws:iam::123456789012:role/LimitedRole"
  duration: 3600
  policy: |
    {
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Action": ["s3:GetObject", "s3:PutObject"],
        "Resource": ["arn:aws:s3:::specific-bucket/*"]
      }]
    }
```

### Credential Output

```json
{
  "AWS_DEPLOY": {
    "AWS_ACCESS_KEY_ID": "ASIATESTACCESSKEY",
    "AWS_SECRET_ACCESS_KEY": "wJalrXUtnFEMI/K7MDENG/bPxRfiCY",
    "AWS_SESSION_TOKEN": "FwoGZXIvYXdzEBYaD...",
    "AWS_REGION": "us-east-1",
    "AWS_DEFAULT_REGION": "us-east-1"
  }
}
```

## Google Cloud Platform

Google Cloud uses service account impersonation for temporary credentials.

### Configuration

```yaml
accessProviders:
  - name: "gcp-prod"
    type: "gcp"
    projectId: "my-project-123"
    
    # Optional configurations
    endpoint: "https://iamcredentials.googleapis.com"
    location: "global"
    
    # Impersonation chain
    delegates:
      - "intermediate-sa@project.iam.gserviceaccount.com"
```

### Key Configuration

```yaml
clientIdentities:
  - subject: "repo:myorg/myapp:ref:refs/heads/main"
    idp: "github-actions"
    keys:
      GCP_DEPLOY:
        provider: "gcp-prod"
        serviceAccount: "deploy-sa@my-project.iam.gserviceaccount.com"
        duration: 3600
        
        # OAuth 2.0 scopes
        scopes:
          - "https://www.googleapis.com/auth/cloud-platform"
          - "https://www.googleapis.com/auth/compute"
          - "https://www.googleapis.com/auth/storage.read_write"
        
        # Impersonation chain
        delegates:
          - "intermediate-sa@project.iam.gserviceaccount.com"
        
        # Output mapping
        outputs:
          GOOGLE_OAUTH_ACCESS_TOKEN: "accessToken"
          GOOGLE_TOKEN_EXPIRY: "expiry"
          GOOGLE_PROJECT_ID: "my-project-123"
          GOOGLE_APPLICATION_CREDENTIALS: "credentialsFile"  # JSON file path
```

### Workload Identity Setup

```bash
# Create workload identity pool
gcloud iam workload-identity-pools create voidkey-pool \
  --location="global" \
  --description="Voidkey workload identity pool"

# Create OIDC provider
gcloud iam workload-identity-pools providers create-oidc voidkey-provider \
  --workload-identity-pool="voidkey-pool" \
  --location="global" \
  --issuer-uri="https://auth.voidkey.example.com" \
  --attribute-mapping="google.subject=assertion.sub,google.groups=assertion.groups"

# Grant impersonation permissions
gcloud iam service-accounts add-iam-policy-binding \
  deploy-sa@my-project.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/PROJECT-NUMBER/locations/global/workloadIdentityPools/voidkey-pool/attribute.subject/broker-service"
```

### Credential Output

```json
{
  "GCP_DEPLOY": {
    "GOOGLE_OAUTH_ACCESS_TOKEN": "ya29.A0ARrdaM-abc123...",
    "GOOGLE_TOKEN_EXPIRY": "2024-01-15T11:00:00Z",
    "GOOGLE_PROJECT_ID": "my-project-123"
  }
}
```

## Azure Active Directory

Azure AD provides managed identity and service principal authentication.

### Configuration

```yaml
accessProviders:
  - name: "azure-prod"
    type: "azure"
    tenantId: "12345678-1234-1234-1234-123456789012"
    
    # Optional configurations
    endpoint: "https://login.microsoftonline.com"
    environment: "AzurePublicCloud"  # AzureUSGovernment, AzureChina, AzureGerman
```

### Key Configuration

```yaml
clientIdentities:
  - subject: "repo:myorg/myapp:ref:refs/heads/main"
    idp: "github-actions"
    keys:
      AZURE_DEPLOY:
        provider: "azure-prod"
        clientId: "12345678-1234-1234-1234-123456789012"
        duration: 3600
        
        # OAuth 2.0 scopes
        scopes:
          - "https://management.azure.com/.default"
          - "https://storage.azure.com/.default"
        
        # Output mapping
        outputs:
          AZURE_ACCESS_TOKEN: "accessToken"
          AZURE_TOKEN_EXPIRY: "expiry"
          AZURE_TENANT_ID: "12345678-1234-1234-1234-123456789012"
          AZURE_CLIENT_ID: "12345678-1234-1234-1234-123456789012"
```

### Federated Identity Setup

```bash
# Create federated identity credential
az ad app federated-credential create \
  --id "app-object-id" \
  --parameters '{
    "name": "voidkey-github",
    "issuer": "https://auth.voidkey.example.com",
    "subject": "broker-service",
    "audiences": ["voidkey-broker"],
    "description": "Voidkey broker federated identity"
  }'

# Assign roles to the application
az role assignment create \
  --assignee "app-object-id" \
  --role "Contributor" \
  --scope "/subscriptions/subscription-id/resourceGroups/my-rg"
```

### Credential Output

```json
{
  "AZURE_DEPLOY": {
    "AZURE_ACCESS_TOKEN": "eyJ0eXAiOiJKV1QiLCJhbGc...",
    "AZURE_TOKEN_EXPIRY": "2024-01-15T11:00:00Z",
    "AZURE_TENANT_ID": "12345678-1234-1234-1234-123456789012",
    "AZURE_CLIENT_ID": "12345678-1234-1234-1234-123456789012"
  }
}
```

## MinIO

MinIO provides S3-compatible object storage with STS support.

### Configuration

```yaml
accessProviders:
  - name: "minio-prod"
    type: "minio"
    endpoint: "https://minio.example.com"
    region: "us-east-1"
    
    # Optional configurations
    pathStyle: true      # Use path-style requests
    insecure: false      # Skip TLS verification (dev only)
    maxDuration: 7200    # 2 hours maximum
```

### Key Configuration

```yaml
clientIdentities:
  - subject: "repo:myorg/myapp:ref:refs/heads/main"
    idp: "github-actions"
    keys:
      MINIO_STORAGE:
        provider: "minio-prod"
        duration: 3600
        
        # IAM policy for scoped access
        policy: |
          {
            "Version": "2012-10-17",
            "Statement": [
              {
                "Effect": "Allow",
                "Action": [
                  "s3:GetObject",
                  "s3:PutObject",
                  "s3:DeleteObject"
                ],
                "Resource": [
                  "arn:aws:s3:::app-uploads/*",
                  "arn:aws:s3:::app-backups/*"
                ]
              },
              {
                "Effect": "Allow",
                "Action": ["s3:ListBucket"],
                "Resource": [
                  "arn:aws:s3:::app-uploads",
                  "arn:aws:s3:::app-backups"
                ]
              }
            ]
          }
        
        # Output mapping
        outputs:
          MINIO_ACCESS_KEY: "AccessKeyId"
          MINIO_SECRET_KEY: "SecretAccessKey"
          MINIO_SESSION_TOKEN: "SessionToken"
          MINIO_ENDPOINT: "https://minio.example.com"
          S3_ENDPOINT: "https://minio.example.com"
```

### MinIO Server Setup

Configure MinIO server with OIDC integration:

```bash
# Environment variables
export MINIO_IDENTITY_OPENID_CONFIG_URL="https://auth.voidkey.example.com/.well-known/openid-configuration"
export MINIO_IDENTITY_OPENID_CLIENT_ID="voidkey-broker"
export MINIO_IDENTITY_OPENID_CLIENT_SECRET="broker-secret"
export MINIO_IDENTITY_OPENID_SCOPES="openid,profile,email"
export MINIO_IDENTITY_OPENID_CLAIM_NAME="policy"
export MINIO_IDENTITY_OPENID_CLAIM_PREFIX="minio"

# Start MinIO
minio server /data --console-address ":9001"
```

### Credential Output

```json
{
  "MINIO_STORAGE": {
    "MINIO_ACCESS_KEY": "ASIATESTACCESSKEY",
    "MINIO_SECRET_KEY": "wJalrXUtnFEMI/K7MDENG/bPxRfiCY",
    "MINIO_SESSION_TOKEN": "eyJhbGciOiJIUzI1NiIs...",
    "MINIO_ENDPOINT": "https://minio.example.com",
    "S3_ENDPOINT": "https://minio.example.com"
  }
}
```

## Custom Access Providers

Implement custom providers for unsupported services.

### Interface Implementation

```typescript
import { AccessProvider, Credentials, ProviderConfig } from '@voidkey/broker-core';

export class CustomAccessProvider implements AccessProvider {
  name: string;
  type: string;

  constructor(private config: CustomProviderConfig) {
    this.name = config.name;
    this.type = 'custom-service';
  }

  async authenticate(brokerToken: string): Promise<void> {
    // Authenticate the broker with the custom service
    // Store authentication context for subsequent requests
    
    const response = await fetch(`${this.config.endpoint}/auth`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${brokerToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      })
    });

    if (!response.ok) {
      throw new Error(`Authentication failed: ${response.statusText}`);
    }

    const authData = await response.json();
    this.authToken = authData.access_token;
  }

  async mintCredentials(
    keyConfig: any,
    subject: string
  ): Promise<Credentials> {
    // Mint temporary credentials for the subject
    
    const response = await fetch(`${this.config.endpoint}/credentials`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.authToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        subject: subject,
        duration: keyConfig.duration,
        permissions: keyConfig.permissions,
        scopes: keyConfig.scopes
      })
    });

    if (!response.ok) {
      throw new Error(`Credential minting failed: ${response.statusText}`);
    }

    const credData = await response.json();

    // Return standardized credential format
    return {
      AccessKeyId: credData.access_key,
      SecretAccessKey: credData.secret_key,
      SessionToken: credData.session_token,
      Expiration: new Date(credData.expires_at),
      
      // Custom fields
      CustomField1: credData.custom_value,
      CustomField2: credData.another_value
    };
  }

  private authToken?: string;
}
```

### Provider Configuration

```typescript
interface CustomProviderConfig {
  name: string;
  endpoint: string;
  clientId: string;
  clientSecret: string;
  timeout?: number;
  retries?: number;
}
```

### Registration

```typescript
// Register custom provider
import { CustomAccessProvider } from './custom-access.provider';

const customProvider = new CustomAccessProvider({
  name: 'custom-service',
  endpoint: 'https://api.custom-service.com',
  clientId: 'voidkey-client',
  clientSecret: process.env.CUSTOM_SERVICE_SECRET
});

// Register with provider registry
providerRegistry.registerAccessProvider('custom-service', customProvider);
```

### Configuration Usage

```yaml
accessProviders:
  - name: "custom-prod"
    type: "custom-service"
    endpoint: "https://api.custom-service.com"
    clientId: "voidkey-client"
    clientSecret: "${CUSTOM_SERVICE_SECRET}"

clientIdentities:
  - subject: "repo:myorg/myapp:ref:refs/heads/main"
    idp: "github-actions"
    keys:
      CUSTOM_ACCESS:
        provider: "custom-prod"
        duration: 3600
        permissions:
          - "read:data"
          - "write:logs"
        scopes:
          - "api:access"
        outputs:
          CUSTOM_ACCESS_KEY: "AccessKeyId"
          CUSTOM_SECRET_KEY: "SecretAccessKey"
          CUSTOM_SESSION_TOKEN: "SessionToken"
          CUSTOM_ENDPOINT: "https://api.custom-service.com"
```

## Provider Best Practices

### Security

1. **Least Privilege:**
```yaml
# Scope credentials to minimum required permissions
policy: |
  {
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::specific-bucket/specific-path/*"]
    }]
  }
```

2. **Short Duration:**
```yaml
# Use shortest practical duration
duration: 900   # 15 minutes for automated tasks
duration: 1800  # 30 minutes for interactive use
duration: 3600  # 1 hour maximum for most cases
```

3. **Audit Trails:**
```yaml
# Include identifying information in session names/tags
sessionName: "voidkey-${subject}-${timestamp}"
tags:
  RequestedBy: "${subject}"
  Purpose: "deployment"
  Repository: "${repository}"
```

### Performance

1. **Connection Pooling:**
```typescript
// Reuse HTTP connections
const agent = new https.Agent({
  keepAlive: true,
  maxSockets: 10
});
```

2. **Caching:**
```typescript
// Cache provider authentication tokens
const authCache = new Map<string, AuthToken>();

async authenticate(brokerToken: string): Promise<void> {
  const cached = authCache.get(this.name);
  if (cached && cached.expiresAt > Date.now()) {
    this.authToken = cached.token;
    return;
  }
  
  // Perform authentication...
  authCache.set(this.name, {
    token: newToken,
    expiresAt: Date.now() + 3600000 // 1 hour
  });
}
```

3. **Parallel Requests:**
```typescript
// Mint multiple credentials in parallel
async mintMultipleCredentials(keyConfigs: KeyConfig[]): Promise<Credentials[]> {
  const promises = keyConfigs.map(config => this.mintCredentials(config));
  return Promise.all(promises);
}
```

### Error Handling

1. **Retries:**
```typescript
async mintCredentials(keyConfig: any, subject: string): Promise<Credentials> {
  const maxRetries = 3;
  let lastError: Error;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await this.doMintCredentials(keyConfig, subject);
    } catch (error) {
      lastError = error;
      
      if (this.isRetryableError(error) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      throw error;
    }
  }

  throw lastError;
}
```

2. **Provider-Specific Errors:**
```typescript
class ProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public errorCode?: string,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'ProviderError';
  }
}

// Usage
if (response.status === 429) {
  throw new ProviderError(
    'Rate limit exceeded',
    this.name,
    'RATE_LIMIT_EXCEEDED',
    true // retryable
  );
}
```

### Monitoring

1. **Metrics:**
```typescript
// Track provider performance
const providerMetrics = {
  requestCount: 0,
  successCount: 0,
  errorCount: 0,
  averageLatency: 0
};

async mintCredentials(keyConfig: any, subject: string): Promise<Credentials> {
  const startTime = Date.now();
  providerMetrics.requestCount++;

  try {
    const result = await this.doMintCredentials(keyConfig, subject);
    providerMetrics.successCount++;
    return result;
  } catch (error) {
    providerMetrics.errorCount++;
    throw error;
  } finally {
    const latency = Date.now() - startTime;
    providerMetrics.averageLatency = 
      (providerMetrics.averageLatency + latency) / 2;
  }
}
```

2. **Health Checks:**
```typescript
async healthCheck(): Promise<boolean> {
  try {
    const response = await fetch(`${this.config.endpoint}/health`, {
      timeout: 5000
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}
```

## Troubleshooting

### Common Issues

**Authentication failures:**
- Verify broker has valid credentials for provider
- Check IdP token is valid and not expired
- Ensure correct audience configuration

**Permission denied:**
- Verify IAM roles/policies are correctly configured
- Check trust relationships and conditions
- Ensure sufficient permissions for assumed role

**Network connectivity:**
- Test provider endpoint accessibility
- Check firewall rules and security groups
- Verify TLS certificates are valid

**Token format errors:**
- Ensure provider returns credentials in expected format
- Check output mapping configuration
- Verify credential field names match expectations

### Debug Commands

```bash
# Test AWS STS access
aws sts get-caller-identity

# Test GCP service account impersonation
gcloud auth print-access-token --impersonate-service-account=sa@project.iam.gserviceaccount.com

# Test Azure authentication
az account get-access-token

# Test MinIO connectivity
mc admin info myminio
```

## Next Steps

- [Identity Providers](/providers/identity/) - Configure identity providers
- [Custom Providers](/providers/custom/) - Build custom providers
- [Configuration Examples](/configuration/examples/) - Real-world configurations
- [Security Model](/architecture/security/) - Security considerations