---
title: Configuration Examples
description: Real-world Voidkey configuration examples
---

This page provides complete configuration examples for common Voidkey deployment scenarios.

## GitHub Actions + AWS

Complete setup for GitHub Actions deploying to AWS:

```yaml
# Voidkey broker configuration
brokerIdp:
  name: "keycloak"
  issuer: "https://auth.myorg.com/realms/voidkey"
  audience: "voidkey-broker"
  clientId: "broker-service"
  clientSecret: "${BROKER_CLIENT_SECRET}"

clientIdps:
  - name: "github-actions"
    issuer: "https://token.actions.githubusercontent.com"
    audience: "https://github.com/myorg"

accessProviders:
  # Production AWS
  - name: "aws-prod"
    type: "aws-sts"
    region: "us-east-1"
    externalId: "${AWS_EXTERNAL_ID}"
  
  # Staging AWS
  - name: "aws-staging"
    type: "aws-sts"
    region: "us-west-2"

clientIdentities:
  # Production deployments from main branch
  - subject: "repo:myorg/webapp:ref:refs/heads/main"
    idp: "github-actions"
    keys:
      AWS_PROD_DEPLOY:
        provider: "aws-prod"
        roleArn: "arn:aws:iam::123456789012:role/GitHubActionsProd"
        duration: 3600
        outputs:
          AWS_ACCESS_KEY_ID: "AccessKeyId"
          AWS_SECRET_ACCESS_KEY: "SecretAccessKey"
          AWS_SESSION_TOKEN: "SessionToken"
          AWS_REGION: "us-east-1"
  
  # Staging deployments from develop branch
  - subject: "repo:myorg/webapp:ref:refs/heads/develop"
    idp: "github-actions"
    keys:
      AWS_STAGING_DEPLOY:
        provider: "aws-staging"
        roleArn: "arn:aws:iam::123456789012:role/GitHubActionsStaging"
        duration: 1800
        outputs:
          AWS_ACCESS_KEY_ID: "AccessKeyId"
          AWS_SECRET_ACCESS_KEY: "SecretAccessKey"
          AWS_SESSION_TOKEN: "SessionToken"
          AWS_REGION: "us-west-2"
```

## Multi-Cloud Setup

Organization using multiple cloud providers:

```yaml
brokerIdp:
  name: "okta"
  issuer: "https://myorg.okta.com/oauth2/default"
  audience: "api://voidkey"
  clientId: "broker-client-id"
  clientSecret: "${OKTA_CLIENT_SECRET}"

clientIdps:
  - name: "github-actions"
    issuer: "https://token.actions.githubusercontent.com"
    audience: "https://github.com/myorg"
  
  - name: "gitlab-ci"
    issuer: "https://gitlab.com"
    audience: "https://gitlab.com/myorg"

accessProviders:
  # AWS for main infrastructure
  - name: "aws-prod"
    type: "aws-sts"
    region: "us-east-1"
  
  # GCP for analytics (Coming Soon)
  # Note: GCP support is currently under development
  - name: "gcp-analytics"
    type: "gcp"
    projectId: "myorg-analytics"
  
  # Azure for legacy systems (Coming Soon)
  # Note: Azure support is currently under development
  - name: "azure-legacy"
    type: "azure"
    tenantId: "12345678-1234-1234-1234-123456789012"

clientIdentities:
  # GitHub Actions can access AWS (and GCP when available)
  - subject: "repo:myorg/main-app:ref:refs/heads/main"
    idp: "github-actions"
    keys:
      AWS_DEPLOY:
        provider: "aws-prod"
        roleArn: "arn:aws:iam::123456789012:role/MainAppDeploy"
        duration: 3600
      
      # GCP_ANALYTICS (Coming Soon - example configuration):
      #   provider: "gcp-analytics"
      #   serviceAccount: "analytics@myorg-analytics.iam.gserviceaccount.com"
      #   duration: 1800
      #   scopes:
      #     - "https://www.googleapis.com/auth/bigquery"
  
  # GitLab CI for Azure legacy systems
  - subject: "project_path:myorg/legacy-app:ref:main:ref_type:branch"
    idp: "gitlab-ci"
    keys:
      # AZURE_DEPLOY (Coming Soon - example configuration):
      #   provider: "azure-legacy"
      #   clientId: "legacy-app-client-id"
      #   duration: 2400
```

## Development Environment

Local development with sandbox services:

```yaml
brokerIdp:
  name: "keycloak-dev"
  issuer: "http://localhost:8080/realms/broker"
  audience: "voidkey-broker"
  clientId: "broker-service"
  clientSecret: "dev-secret-12345"

clientIdps:
  - name: "keycloak-client"
    issuer: "http://localhost:8080/realms/client"
    audience: "test-client"

accessProviders:
  - name: "minio-local"
    type: "minio"
    endpoint: "http://localhost:9000"
    region: "us-east-1"
    pathStyle: true
    insecure: true

clientIdentities:
  - subject: "test-user"
    idp: "keycloak-client"
    keys:
      MINIO_TEST:
        provider: "minio-local"
        duration: 7200
        policy: |
          {
            "Version": "2012-10-17",
            "Statement": [{
              "Effect": "Allow",
              "Action": ["s3:*"],
              "Resource": ["arn:aws:s3:::test-bucket/*"]
            }]
          }
        outputs:
          MINIO_ACCESS_KEY: "AccessKeyId"
          MINIO_SECRET_KEY: "SecretAccessKey"
          MINIO_SESSION_TOKEN: "SessionToken"
          MINIO_ENDPOINT: "http://localhost:9000"
```

## Enterprise Setup

Large organization with multiple teams and environments:

```yaml
brokerIdp:
  name: "enterprise-ad"
  issuer: "https://login.microsoftonline.com/tenant-id/v2.0"
  audience: "api://voidkey-prod"
  clientId: "enterprise-broker-client"
  clientSecret: "${AZURE_CLIENT_SECRET}"

clientIdps:
  # GitHub Enterprise
  - name: "github-enterprise"
    issuer: "https://github.enterprise.com/_services/token"
    audience: "https://github.enterprise.com/myorg"
  
  # Auth0 for developers
  - name: "auth0-dev"
    issuer: "https://myorg.auth0.com/"
    audience: 
      - "https://api.myorg.com"
      - "https://voidkey.myorg.com"
  
  # Okta for operations
  - name: "okta-ops"
    issuer: "https://myorg.okta.com/oauth2/default"
    audience: "api://operations"

accessProviders:
  # Production AWS accounts
  - name: "aws-prod-us"
    type: "aws-sts"
    region: "us-east-1"
    externalId: "${AWS_PROD_EXTERNAL_ID}"
  
  - name: "aws-prod-eu"
    type: "aws-sts"
    region: "eu-west-1"
    externalId: "${AWS_PROD_EXTERNAL_ID}"
  
  # Development accounts
  - name: "aws-dev"
    type: "aws-sts"
    region: "us-west-2"
  
  # GCP for data platform (Coming Soon)
  # Note: GCP support is currently under development
  - name: "gcp-data"
    type: "gcp"
    projectId: "myorg-data-platform"

clientIdentities:
  # DevOps team - production access
  - subject: "repo:myorg/infrastructure:ref:refs/heads/main"
    idp: "github-enterprise"
    keys:
      AWS_PROD_US_ADMIN:
        provider: "aws-prod-us"
        roleArn: "arn:aws:iam::prod-account:role/InfrastructureAdmin"
        duration: 1800
      
      AWS_PROD_EU_ADMIN:
        provider: "aws-prod-eu"
        roleArn: "arn:aws:iam::prod-account:role/InfrastructureAdmin"
        duration: 1800
  
  # Development teams - dev environment access
  - subject: "user:alice@myorg.com"
    idp: "auth0-dev"
    keys:
      AWS_DEV_FULL:
        provider: "aws-dev"
        roleArn: "arn:aws:iam::dev-account:role/DeveloperFull"
        duration: 7200
  
  # Data team - GCP access (Coming Soon - example configuration)
  # - subject: "repo:myorg/data-pipeline:ref:refs/heads/main"
  #   idp: "github-enterprise"
  #   keys:
  #     GCP_DATA_PROCESSOR:
  #       provider: "gcp-data"
  #       serviceAccount: "pipeline@myorg-data-platform.iam.gserviceaccount.com"
  #       duration: 3600
  #       scopes:
  #         - "https://www.googleapis.com/auth/bigquery"
  #         - "https://www.googleapis.com/auth/dataflow"
  
  # Operations team - monitoring access
  - subject: "group:ops-team"
    idp: "okta-ops"
    keys:
      AWS_READONLY:
        provider: "aws-prod-us"
        roleArn: "arn:aws:iam::prod-account:role/ReadOnlyAccess"
        duration: 14400
```

## High Security Environment

Configuration for organizations with strict security requirements:

```yaml
brokerIdp:
  name: "internal-ca"
  issuer: "https://ca.internal.myorg.com/auth/realms/voidkey"
  audience: "urn:voidkey:broker"
  clientId: "voidkey-broker-service"
  clientSecret: "${BROKER_SECRET}"

clientIdps:
  - name: "internal-ci"
    issuer: "https://ci.internal.myorg.com/auth"
    audience: "urn:ci:voidkey"
    # Custom JWKS for internal CA
    jwksUri: "https://ca.internal.myorg.com/auth/keys"

accessProviders:
  - name: "aws-govcloud"
    type: "aws-sts"
    region: "us-gov-west-1"
    endpoint: "https://sts.us-gov-west-1.amazonaws.com"
    externalId: "${AWS_GOVCLOUD_EXTERNAL_ID}"
    maxDuration: 900  # 15 minutes maximum

clientIdentities:
  - subject: "pipeline:secure-deployment:branch:main"
    idp: "internal-ci"
    keys:
      AWS_GOVCLOUD_DEPLOY:
        provider: "aws-govcloud"
        roleArn: "arn:aws-us-gov:iam::123456789012:role/SecureDeployment"
        duration: 900  # Short duration for security
        externalId: "secure-external-id-12345"
        sessionName: "voidkey-${timestamp}"
        outputs:
          AWS_ACCESS_KEY_ID: "AccessKeyId"
          AWS_SECRET_ACCESS_KEY: "SecretAccessKey"
          AWS_SESSION_TOKEN: "SessionToken"
          AWS_REGION: "us-gov-west-1"

# Enhanced logging for compliance
logging:
  level: "info"
  audit: true
  format: "json"
  destinations:
    - type: "file"
      path: "/var/log/voidkey/audit.log"
    - type: "syslog"
      facility: "auth"
    - type: "splunk"
      endpoint: "https://splunk.internal.myorg.com:8088"

# Security settings
security:
  tokenValidation:
    strictAudience: true
    requireNotBefore: true
    clockSkewTolerance: 30
  
  rateLimiting:
    enabled: true
    requests: 60
    window: 300  # 5 minutes
  
  cors:
    enabled: false  # Disable CORS in high-security environment
```

## Testing Configuration

Configuration for automated testing environments:

```yaml
brokerIdp:
  name: "test-keycloak"
  issuer: "http://keycloak:8080/realms/test"
  audience: "test-audience"
  clientId: "test-client"
  clientSecret: "test-secret"

clientIdps:
  - name: "test-idp"
    issuer: "http://keycloak:8080/realms/client"
    audience: "test-client"

accessProviders:
  - name: "localstack"
    type: "aws-sts"
    endpoint: "http://localstack:4566"
    region: "us-east-1"
  
  - name: "minio-test"
    type: "minio"
    endpoint: "http://minio:9000"
    region: "us-east-1"
    pathStyle: true
    insecure: true

clientIdentities:
  - subject: "test-user"
    idp: "test-idp"
    keys:
      AWS_TEST:
        provider: "localstack"
        roleArn: "arn:aws:iam::000000000000:role/TestRole"
        duration: 3600
      
      MINIO_TEST:
        provider: "minio-test"
        duration: 3600
        policy: |
          {
            "Version": "2012-10-17",
            "Statement": [{
              "Effect": "Allow",
              "Action": ["s3:*"],
              "Resource": ["*"]
            }]
          }

# Test-specific settings
debug: true
logging:
  level: "debug"
  format: "pretty"
```

## Environment-Specific Overrides

Using environment variables for different deployments:

```yaml
# Base configuration
brokerIdp:
  name: "${BROKER_IDP_NAME:-keycloak}"
  issuer: "${BROKER_IDP_ISSUER}"
  audience: "${BROKER_IDP_AUDIENCE}"
  clientId: "${BROKER_IDP_CLIENT_ID}"
  clientSecret: "${BROKER_IDP_CLIENT_SECRET}"

clientIdps:
  - name: "github"
    issuer: "https://token.actions.githubusercontent.com"
    audience: "${GITHUB_AUDIENCE:-https://github.com/myorg}"

accessProviders:
  - name: "aws-${ENVIRONMENT:-dev}"
    type: "aws-sts"
    region: "${AWS_REGION:-us-east-1}"
    externalId: "${AWS_EXTERNAL_ID}"

clientIdentities:
  - subject: "repo:myorg/${REPO_NAME}:ref:refs/heads/${BRANCH_NAME:-main}"
    idp: "github"
    keys:
      AWS_DEPLOY:
        provider: "aws-${ENVIRONMENT:-dev}"
        roleArn: "${AWS_ROLE_ARN}"
        duration: "${SESSION_DURATION:-3600}"
        outputs:
          AWS_ACCESS_KEY_ID: "AccessKeyId"
          AWS_SECRET_ACCESS_KEY: "SecretAccessKey"
          AWS_SESSION_TOKEN: "SessionToken"
          AWS_REGION: "${AWS_REGION:-us-east-1}"
```

## Next Steps

- [Identity Providers](/configuration/identity-providers/) - Detailed IdP configuration
- [Access Providers](/configuration/access-providers/) - Cloud provider specifics
- [Security Model](/architecture/security/) - Security considerations
- [GitHub Actions Example](/examples/github-actions/) - Detailed integration guide