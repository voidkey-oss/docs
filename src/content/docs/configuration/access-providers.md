---
title: Access Providers Configuration
description: Configure cloud providers for credential minting
---

This guide covers configuring access providers that mint temporary credentials for cloud resources.

## Supported Access Providers

Voidkey includes built-in support for:

- **AWS STS** - Amazon Web Services Security Token Service
- **MinIO** - S3-compatible object storage with STS
- **Google Cloud** - Google Cloud Platform service account impersonation
- **Azure** - Microsoft Azure identity services

## Basic Configuration

Access providers are configured in the `accessProviders` section:

```yaml
accessProviders:
  - name: "aws-prod"
    type: "aws-sts"
    region: "us-east-1"
```

### Common Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Unique identifier for the provider |
| `type` | string | Yes | Provider type (aws-sts, minio, gcp, azure) |
| `endpoint` | string | No | Custom API endpoint |
| `region` | string | Varies | Cloud region |

## AWS STS Provider

Configure AWS Security Token Service for temporary AWS credentials:

```yaml
accessProviders:
  - name: "aws-prod"
    type: "aws-sts"
    region: "us-east-1"
    
    # Optional configurations
    endpoint: "https://sts.amazonaws.com"  # Custom endpoint
    externalId: "${AWS_EXTERNAL_ID}"      # External ID for trust policy
    maxDuration: 3600                     # Maximum session duration
    
    # Optional session tags
    tags:
      Environment: "production"
      ManagedBy: "voidkey"
      Project: "myapp"
```

### AWS Configuration Options

| Field | Type | Description |
|-------|------|-------------|
| `region` | string | AWS region (required) |
| `endpoint` | string | Custom STS endpoint (for GovCloud, China) |
| `externalId` | string | External ID for AssumeRole |
| `maxDuration` | number | Maximum session duration in seconds |
| `tags` | object | Session tags to apply |

### AWS Identity Configuration

Configure which AWS roles can be assumed:

```yaml
clientIdentities:
  - subject: "repo:myorg/myapp:ref:refs/heads/main"
    idp: "github-actions"
    keys:
      AWS_PROD_DEPLOY:
        provider: "aws-prod"
        roleArn: "arn:aws:iam::123456789012:role/GitHubActionsDeploy"
        duration: 3600
        sessionName: "github-${GITHUB_RUN_ID}"  # Dynamic session name
        externalId: "custom-external-id"        # Override provider default
        outputs:
          AWS_ACCESS_KEY_ID: "AccessKeyId"
          AWS_SECRET_ACCESS_KEY: "SecretAccessKey"
          AWS_SESSION_TOKEN: "SessionToken"
          AWS_REGION: "us-east-1"
```

### AWS IAM Trust Policy

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
        }
      }
    }
  ]
}
```

### AWS OIDC Provider Setup

1. Create OIDC Identity Provider in AWS IAM
2. Set Provider URL to your broker's IdP issuer
3. Set Audience to your broker's audience
4. Add thumbprint for the IdP's certificate

```bash
# Get IdP thumbprint
echo | openssl s_client -servername auth.voidkey.example.com \
  -connect auth.voidkey.example.com:443 2>/dev/null | \
  openssl x509 -fingerprint -noout -sha1 | \
  cut -d= -f2 | tr -d :
```

## MinIO Provider

Configure MinIO for S3-compatible storage with STS support:

```yaml
accessProviders:
  - name: "minio-local"
    type: "minio"
    endpoint: "http://localhost:9000"
    region: "us-east-1"
    
    # Optional configurations
    pathStyle: true      # Use path-style requests
    insecure: true       # Skip TLS verification (dev only)
    maxDuration: 3600    # Maximum session duration
```

### MinIO Configuration Options

| Field | Type | Description |
|-------|------|-------------|
| `endpoint` | string | MinIO server endpoint (required) |
| `region` | string | Region name (required, can be arbitrary) |
| `pathStyle` | boolean | Use path-style requests |
| `insecure` | boolean | Skip TLS verification |
| `maxDuration` | number | Maximum session duration |

### MinIO Identity Configuration

```yaml
clientIdentities:
  - subject: "repo:myorg/myapp:ref:refs/heads/main"
    idp: "github-actions"
    keys:
      MINIO_STORAGE:
        provider: "minio-local"
        duration: 3600
        
        # Optional: Custom policy
        policy: |
          {
            "Version": "2012-10-17",
            "Statement": [{
              "Effect": "Allow",
              "Action": ["s3:GetObject", "s3:PutObject"],
              "Resource": ["arn:aws:s3:::uploads/*"]
            }]
          }
        
        outputs:
          MINIO_ACCESS_KEY: "AccessKeyId"
          MINIO_SECRET_KEY: "SecretAccessKey"
          MINIO_SESSION_TOKEN: "SessionToken"
          MINIO_ENDPOINT: "http://localhost:9000"
```

### MinIO Server Setup

Configure MinIO server with OIDC integration:

```bash
# MinIO environment variables
export MINIO_IDENTITY_OPENID_CONFIG_URL="https://auth.voidkey.example.com/.well-known/openid-configuration"
export MINIO_IDENTITY_OPENID_CLIENT_ID="voidkey-broker"
export MINIO_IDENTITY_OPENID_CLIENT_SECRET="broker-secret"
export MINIO_IDENTITY_OPENID_SCOPES="openid,profile,email"
export MINIO_IDENTITY_OPENID_CLAIM_NAME="policy"

# Start MinIO
minio server /data --console-address ":9001"
```

## Google Cloud Provider

Configure Google Cloud for service account impersonation:

```yaml
accessProviders:
  - name: "gcp-prod"
    type: "gcp"
    projectId: "my-project-123"
    
    # Optional configurations
    endpoint: "https://iamcredentials.googleapis.com"
    location: "global"
    
    # Service account impersonation chain
    delegates:
      - "intermediate-sa@project.iam.gserviceaccount.com"
```

### GCP Configuration Options

| Field | Type | Description |
|-------|------|-------------|
| `projectId` | string | Google Cloud project ID (required) |
| `endpoint` | string | Custom IAM credentials endpoint |
| `location` | string | Resource location |
| `delegates` | string[] | Impersonation chain |

### GCP Identity Configuration

```yaml
clientIdentities:
  - subject: "repo:myorg/myapp:ref:refs/heads/main"
    idp: "github-actions"
    keys:
      GCP_DEPLOY:
        provider: "gcp-prod"
        serviceAccount: "deploy-sa@my-project.iam.gserviceaccount.com"
        duration: 3600
        
        # Scopes for the access token
        scopes:
          - "https://www.googleapis.com/auth/cloud-platform"
          - "https://www.googleapis.com/auth/compute"
        
        outputs:
          GOOGLE_OAUTH_ACCESS_TOKEN: "accessToken"
          GOOGLE_TOKEN_EXPIRY: "expiry"
          GOOGLE_PROJECT_ID: "my-project-123"
```

### GCP Workload Identity Setup

1. Create Workload Identity Pool
2. Add Workload Identity Provider
3. Configure attribute mappings
4. Grant service account impersonation

```bash
# Create workload identity pool
gcloud iam workload-identity-pools create voidkey-pool \
  --location="global" \
  --description="Voidkey workload identity pool"

# Create provider
gcloud iam workload-identity-pools providers create-oidc voidkey-provider \
  --workload-identity-pool="voidkey-pool" \
  --location="global" \
  --issuer-uri="https://auth.voidkey.example.com" \
  --attribute-mapping="google.subject=assertion.sub"

# Grant impersonation
gcloud iam service-accounts add-iam-policy-binding \
  deploy-sa@my-project.iam.gserviceaccount.com \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/PROJECT-NUMBER/locations/global/workloadIdentityPools/voidkey-pool/attribute.repository/myorg/myapp"
```

## Azure Provider

Configure Azure Active Directory for managed identity:

```yaml
accessProviders:
  - name: "azure-prod"
    type: "azure"
    tenantId: "12345678-1234-1234-1234-123456789012"
    
    # Optional configurations
    environment: "AzurePublicCloud"  # or AzureUSGovernment, AzureChina
    endpoint: "https://login.microsoftonline.com"
```

### Azure Configuration Options

| Field | Type | Description |
|-------|------|-------------|
| `tenantId` | string | Azure AD tenant ID (required) |
| `environment` | string | Azure cloud environment |
| `endpoint` | string | Custom Azure AD endpoint |

### Azure Identity Configuration

```yaml
clientIdentities:
  - subject: "repo:myorg/myapp:ref:refs/heads/main"
    idp: "github-actions"
    keys:
      AZURE_DEPLOY:
        provider: "azure-prod"
        clientId: "12345678-1234-1234-1234-123456789012"
        duration: 3600
        
        # Scopes for the access token
        scopes:
          - "https://management.azure.com/.default"
        
        outputs:
          AZURE_ACCESS_TOKEN: "accessToken"
          AZURE_TOKEN_EXPIRY: "expiry"
          AZURE_TENANT_ID: "12345678-1234-1234-1234-123456789012"
```

### Azure Federated Identity Setup

1. Register application in Azure AD
2. Create federated identity credential
3. Configure subject identifier
4. Assign appropriate roles

```bash
# Create federated identity credential
az ad app federated-credential create \
  --id "app-object-id" \
  --parameters '{
    "name": "voidkey-github",
    "issuer": "https://auth.voidkey.example.com",
    "subject": "broker-service",
    "audiences": ["voidkey-broker"]
  }'
```

## Multi-Region Configuration

Configure providers for multiple regions:

```yaml
accessProviders:
  # US East
  - name: "aws-us-east"
    type: "aws-sts"
    region: "us-east-1"
  
  # EU West
  - name: "aws-eu-west"
    type: "aws-sts"
    region: "eu-west-1"
  
  # Asia Pacific
  - name: "aws-ap-southeast"
    type: "aws-sts"
    region: "ap-southeast-1"

clientIdentities:
  - subject: "repo:myorg/myapp:ref:refs/heads/main"
    idp: "github-actions"
    keys:
      AWS_US_DEPLOY:
        provider: "aws-us-east"
        roleArn: "arn:aws:iam::123456789012:role/USDeployRole"
      
      AWS_EU_DEPLOY:
        provider: "aws-eu-west"
        roleArn: "arn:aws:iam::123456789012:role/EUDeployRole"
      
      AWS_ASIA_DEPLOY:
        provider: "aws-ap-southeast"
        roleArn: "arn:aws:iam::123456789012:role/AsiaDeployRole"
```

## Custom Providers

Create custom providers for unsupported services:

```typescript
// Custom access provider implementation
import { AccessProvider, Credentials } from '@voidkey/broker-core';

export class CustomAccessProvider implements AccessProvider {
  name: string;
  type: string;

  constructor(private config: CustomProviderConfig) {
    this.name = config.name;
    this.type = 'custom';
  }

  async mintCredentials(keyConfig: any, subject: string): Promise<Credentials> {
    // 1. Authenticate with provider
    // 2. Request temporary credentials
    // 3. Return standardized credential format
    
    return {
      AccessKeyId: 'temp-access-key',
      SecretAccessKey: 'temp-secret-key',
      SessionToken: 'temp-session-token',
      Expiration: new Date(Date.now() + keyConfig.duration * 1000)
    };
  }
}
```

Register custom provider:

```typescript
// In broker server startup
const customProvider = new CustomAccessProvider(config);
providerRegistry.registerAccessProvider('custom', customProvider);
```

## Security Best Practices

### Principle of Least Privilege

1. **Scope Roles Narrowly**
   ```json
   {
     "Effect": "Allow",
     "Action": [
       "s3:GetObject",
       "s3:PutObject"
     ],
     "Resource": [
       "arn:aws:s3:::specific-bucket/*"
     ]
   }
   ```

2. **Use Time-Limited Sessions**
   ```yaml
   duration: 900  # 15 minutes for CI/CD
   maxDuration: 3600  # 1 hour maximum
   ```

3. **Add Session Tags**
   ```yaml
   tags:
     Purpose: "deployment"
     Requester: "${subject}"
     Timestamp: "${timestamp}"
   ```

### Network Security

1. **Use Private Endpoints**
   ```yaml
   endpoint: "https://sts.us-gov-east-1.amazonaws.com"  # GovCloud
   ```

2. **Validate Certificates**
   ```yaml
   insecure: false  # Always validate TLS certificates
   ```

3. **Restrict IP Ranges**
   ```json
   {
     "Condition": {
       "IpAddress": {
         "aws:SourceIp": ["203.0.113.0/24"]
       }
     }
   }
   ```

## Troubleshooting

### Common Issues

**"Access denied" errors**
- Check IAM role trust policy
- Verify external ID matches
- Confirm broker has assume role permissions

**"Invalid provider configuration"**
- Validate required fields are present
- Check endpoint URLs are accessible
- Verify region names are correct

**"Token exchange failed"**
- Ensure broker can authenticate with provider
- Check OIDC provider configuration
- Verify audience and issuer settings

### Debug Commands

```bash
# Test AWS STS access
aws sts get-caller-identity

# Check OIDC provider thumbprint
openssl s_client -connect auth.example.com:443 -servername auth.example.com | \
  openssl x509 -fingerprint -noout -sha1

# Verify role trust policy
aws iam get-role --role-name MyRole
```

### Logging

Enable detailed logging for provider operations:

```yaml
logging:
  level: debug
  providers:
    aws: debug
    gcp: info
    azure: warn
```

## Next Steps

- [Configuration Examples](/configuration/examples/) - Real-world configurations
- [Identity Providers](/configuration/identity-providers/) - IdP configuration
- [Security Model](/architecture/security/) - Security considerations
- [Deployment Guide](/deployment/production/) - Production deployment