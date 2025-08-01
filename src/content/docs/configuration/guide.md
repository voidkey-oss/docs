---
title: Configuration Guide
description: Complete guide to configuring Voidkey
---

This guide covers all aspects of configuring Voidkey, from basic setup to advanced scenarios.

## Configuration Overview

Voidkey uses a YAML-based configuration system with four main sections:

1. **brokerIdp** - The broker's own identity provider
2. **clientIdps** - Identity providers that clients can use
3. **accessProviders** - Cloud providers for credential minting
4. **clientIdentities** - Identity-to-permission mappings

## Configuration File Location

The broker server looks for configuration in these locations (in order):

1. Path specified in `CONFIG_PATH` environment variable
2. `./config/config.yaml` (relative to working directory)
3. `/etc/voidkey/config.yaml` (system-wide)
4. `~/.voidkey/config.yaml` (user-specific)

## Basic Configuration

Here's a minimal configuration to get started:

```yaml
# The broker's own identity provider
brokerIdp:
  name: "keycloak"
  issuer: "https://auth.example.com/realms/voidkey"
  audience: "voidkey-broker"
  clientId: "broker-service"
  clientSecret: "${BROKER_CLIENT_SECRET}"  # From environment

# Client identity providers
clientIdps:
  - name: "github-actions"
    issuer: "https://token.actions.githubusercontent.com"
    audience: "https://github.com/myorg"

# Cloud providers
accessProviders:
  - name: "aws-dev"
    type: "aws-sts"
    region: "us-east-1"

# Identity mappings
clientIdentities:
  - subject: "repo:myorg/myapp:ref:refs/heads/main"
    idp: "github-actions"
    keys:
      AWS_DEPLOY:
        provider: "aws-dev"
        roleArn: "arn:aws:iam::123456789012:role/DeployRole"
        duration: 3600
```

## Broker Identity Provider

The broker authenticates with its own IdP to access cloud providers:

```yaml
brokerIdp:
  name: "auth0"  # Descriptive name
  issuer: "https://myorg.auth0.com/"
  audience: "https://voidkey.myorg.com"
  clientId: "broker-service-client"
  clientSecret: "${BROKER_CLIENT_SECRET}"
  
  # Optional: Custom token endpoint
  tokenEndpoint: "https://myorg.auth0.com/oauth/token"
  
  # Optional: Additional scopes
  scopes:
    - "read:resources"
    - "write:credentials"
```

### Supported Broker IdPs

- **Keycloak**: Generic OIDC provider
- **Auth0**: SaaS identity platform
- **Okta**: Enterprise identity provider
- **Azure AD**: Microsoft identity platform

## Client Identity Providers

Configure which IdPs clients can authenticate with:

```yaml
clientIdps:
  # GitHub Actions OIDC
  - name: "github-actions"
    issuer: "https://token.actions.githubusercontent.com"
    audience: "https://github.com/myorg"
    
  # Auth0 for developers
  - name: "auth0-dev"
    issuer: "https://dev.auth0.com/"
    audience: 
      - "https://api.myorg.com"
      - "https://voidkey.myorg.com"
    
  # Keycloak with custom JWKS
  - name: "keycloak"
    issuer: "https://auth.example.com/realms/developers"
    jwksUri: "https://auth.example.com/realms/developers/protocol/openid-connect/certs"
    
  # Okta with multiple audiences
  - name: "okta"
    issuer: "https://myorg.okta.com/oauth2/default"
    audience:
      - "api://voidkey"
      - "api://default"
```

### Audience Validation

Audience validation can be configured per IdP:

```yaml
clientIdps:
  - name: "flexible-idp"
    issuer: "https://idp.example.com"
    # No audience = skip audience validation (not recommended)
    
  - name: "strict-idp"
    issuer: "https://idp.example.com"
    audience: "https://api.example.com"  # Exact match required
    
  - name: "multi-audience-idp"
    issuer: "https://idp.example.com"
    audience:  # Token must contain at least one
      - "https://api.example.com"
      - "https://voidkey.example.com"
```

## Access Providers

Configure cloud providers for credential minting:

### AWS STS

```yaml
accessProviders:
  - name: "aws-prod"
    type: "aws-sts"
    region: "us-east-1"
    
    # Optional: Custom endpoint for GovCloud/China
    endpoint: "https://sts.us-gov-east-1.amazonaws.com"
    
    # Optional: External ID for assume role
    externalId: "${AWS_EXTERNAL_ID}"
    
    # Optional: Session tags
    tags:
      Environment: "production"
      ManagedBy: "voidkey"
```

### MinIO

```yaml
accessProviders:
  - name: "minio-local"
    type: "minio"
    endpoint: "http://localhost:9000"
    region: "us-east-1"  # MinIO requires a region
    
    # Optional: Use path-style requests
    pathStyle: true
    
    # Optional: Skip TLS verification (dev only!)
    insecure: true
```

### Google Cloud

```yaml
accessProviders:
  - name: "gcp-prod"
    type: "gcp"
    projectId: "my-project-123"
    
    # Optional: Custom endpoint
    endpoint: "https://iamcredentials.googleapis.com"
    
    # Optional: Impersonation chain
    delegates:
      - "intermediate-sa@project.iam.gserviceaccount.com"
```

### Azure

```yaml
accessProviders:
  - name: "azure-prod"
    type: "azure"
    tenantId: "12345678-1234-1234-1234-123456789012"
    
    # Optional: Azure cloud environment
    environment: "AzurePublicCloud"  # or AzureUSGovernment, AzureChina, AzureGerman
```

## Client Identities

Map client identities to permissions:

### Basic Identity

```yaml
clientIdentities:
  - subject: "user:alice@example.com"
    idp: "auth0-dev"
    keys:
      S3_READONLY:
        provider: "aws-dev"
        roleArn: "arn:aws:iam::123456789012:role/S3ReadOnly"
        duration: 3600  # 1 hour
```

### Advanced Key Configuration

```yaml
clientIdentities:
  - subject: "repo:myorg/myapp:ref:refs/heads/main"
    idp: "github-actions"
    keys:
      # AWS deployment credentials
      AWS_DEPLOY:
        provider: "aws-prod"
        roleArn: "arn:aws:iam::123456789012:role/Deploy"
        duration: 1800  # 30 minutes
        sessionName: "github-${GITHUB_RUN_ID}"  # Dynamic session name
        outputs:
          AWS_ACCESS_KEY_ID: "AccessKeyId"
          AWS_SECRET_ACCESS_KEY: "SecretAccessKey"
          AWS_SESSION_TOKEN: "SessionToken"
          AWS_REGION: "us-east-1"  # Static value
      
      # MinIO credentials with custom policy
      MINIO_STORAGE:
        provider: "minio-local"
        duration: 7200  # 2 hours
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
      
      # GCP service account impersonation
      GCP_DEPLOY:
        provider: "gcp-prod"
        serviceAccount: "deploy-sa@my-project.iam.gserviceaccount.com"
        duration: 3600
        scopes:
          - "https://www.googleapis.com/auth/cloud-platform"
        outputs:
          GOOGLE_OAUTH_ACCESS_TOKEN: "accessToken"
          GOOGLE_TOKEN_EXPIRY: "expiry"
```

### Pattern Matching (Future)

```yaml
clientIdentities:
  # Exact match (current)
  - subject: "repo:myorg/myapp:ref:refs/heads/main"
    idp: "github-actions"
    keys: ...
  
  # Planned: Wildcard support
  - subject: "repo:myorg/myapp:ref:refs/heads/*"
    idp: "github-actions"
    keys: ...
  
  # Planned: Regex patterns
  - subject: "^repo:myorg/.*:ref:refs/tags/v.*$"
    idp: "github-actions"
    keys: ...
```

## Environment Variables

Configuration values can reference environment variables:

```yaml
brokerIdp:
  clientSecret: "${BROKER_CLIENT_SECRET}"
  
accessProviders:
  - name: "aws"
    externalId: "${AWS_EXTERNAL_ID:-default-external-id}"  # With default
    
clientIdentities:
  - subject: "service:${SERVICE_NAME}"
    keys:
      DYNAMIC_KEY:
        roleArn: "arn:aws:iam::${AWS_ACCOUNT_ID}:role/${ROLE_NAME}"
```

## Advanced Configuration

### Multiple Environments

Organize configuration by environment:

```yaml
# config/base.yaml - Shared configuration
clientIdps:
  - name: "github-actions"
    issuer: "https://token.actions.githubusercontent.com"

# config/dev.yaml - Development overrides
includes:
  - base.yaml

accessProviders:
  - name: "aws-dev"
    type: "aws-sts"
    region: "us-east-1"

# config/prod.yaml - Production overrides  
includes:
  - base.yaml
  
accessProviders:
  - name: "aws-prod"
    type: "aws-sts"
    region: "us-east-1"
    externalId: "${PROD_EXTERNAL_ID}"
```

### High Availability Configuration

```yaml
# Timeouts and retries
broker:
  httpTimeout: 30000  # 30 seconds
  maxRetries: 3
  retryDelay: 1000  # 1 second

# Cache configuration
cache:
  jwks:
    ttl: 3600  # 1 hour
    maxSize: 100
  
  tokens:
    ttl: 300  # 5 minutes
    maxSize: 1000

# Health check configuration
health:
  enabled: true
  path: "/health"
  checks:
    - name: "broker-idp"
      type: "http"
      url: "${BROKER_IDP_ISSUER}/.well-known/openid-configuration"
    - name: "aws-sts"
      type: "aws"
      region: "us-east-1"
```

### Logging Configuration

```yaml
logging:
  level: "info"  # debug, info, warn, error
  format: "json"  # json, pretty
  
  # Sensitive data redaction
  redact:
    - "password"
    - "secret"
    - "token"
    - "key"
  
  # Audit logging
  audit:
    enabled: true
    file: "/var/log/voidkey/audit.log"
    maxSize: "100MB"
    maxFiles: 10
```

## Configuration Validation

The broker validates configuration on startup:

1. **Schema Validation**: Ensures required fields present
2. **IdP Validation**: Verifies issuer URLs accessible
3. **Provider Validation**: Checks provider configurations
4. **Identity Validation**: Ensures no duplicate subjects

### Validation Errors

```bash
# Missing required field
Error: brokerIdp.clientId is required

# Invalid provider type
Error: Unknown provider type 'invalid' for provider 'my-provider'

# Duplicate subject
Error: Duplicate subject 'user:alice@example.com' in clientIdentities

# Unreachable IdP
Warning: Cannot reach IdP 'auth0-dev' at https://dev.auth0.com/.well-known/openid-configuration
```

## Security Best Practices

1. **Never commit secrets**
   ```yaml
   # Bad
   clientSecret: "my-secret-value"
   
   # Good
   clientSecret: "${BROKER_CLIENT_SECRET}"
   ```

2. **Use specific audiences**
   ```yaml
   # Bad - Too broad
   audience: "*"
   
   # Good - Specific
   audience: "https://voidkey.myorg.com"
   ```

3. **Limit token duration**
   ```yaml
   # Consider your use case
   duration: 900   # 15 minutes for CI/CD
   duration: 3600  # 1 hour for development
   duration: 7200  # 2 hours maximum
   ```

4. **Restrict access by environment**
   ```yaml
   # Separate prod/dev access
   clientIdentities:
     - subject: "repo:myorg/myapp:ref:refs/heads/main"
       keys:
         AWS_PROD: ...
     
     - subject: "repo:myorg/myapp:ref:refs/heads/develop"
       keys:
         AWS_DEV: ...
   ```

## Next Steps

- [Identity Providers](/configuration/identity-providers/) - Detailed IdP configuration
- [Access Providers](/configuration/access-providers/) - Cloud provider specifics
- [Examples](/configuration/examples/) - Real-world configurations
- [Deployment](/deployment/production/) - Production deployment guide