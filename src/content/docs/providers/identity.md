---
title: Identity Providers
description: Available identity providers for client authentication
---

This page details all identity providers supported by Voidkey for client authentication.

## Overview

Identity providers (IdPs) authenticate clients and issue OIDC tokens that Voidkey validates. Each provider has specific configuration requirements and token formats.

## GitHub Actions

GitHub Actions provides built-in OIDC token support for secure CI/CD workflows.

### Configuration

```yaml
clientIdps:
  - name: "github-actions"
    issuer: "https://token.actions.githubusercontent.com"
    audience: "https://github.com/myorg"
```

### Token Claims

GitHub Actions tokens include these standard claims:

| Claim | Description | Example |
|-------|-------------|---------|
| `iss` | Token issuer | `https://token.actions.githubusercontent.com` |
| `aud` | Repository audience | `https://github.com/myorg` |
| `sub` | Subject identifier | `repo:owner/repo:ref:refs/heads/main` |
| `repository` | Repository name | `myorg/myapp` |
| `repository_owner` | Repository owner | `myorg` |
| `ref` | Git reference | `refs/heads/main` |
| `ref_type` | Reference type | `branch` |
| `run_id` | Workflow run ID | `1234567890` |
| `job_workflow_ref` | Workflow reference | `myorg/myapp/.github/workflows/deploy.yml@refs/heads/main` |

### Subject Formats

Different GitHub Actions contexts produce different subject formats:

```yaml
# Branch push
"repo:myorg/myapp:ref:refs/heads/main"
"repo:myorg/myapp:ref:refs/heads/feature/xyz"

# Tag push
"repo:myorg/myapp:ref:refs/tags/v1.0.0"

# Pull request
"repo:myorg/myapp:pull_request"

# Environment deployment
"repo:myorg/myapp:environment:production"
"repo:myorg/myapp:environment:staging"
```

### Integration Example

```yaml
# .github/workflows/deploy.yml
name: Deploy
on:
  push:
    branches: [main]

permissions:
  id-token: write  # Required for OIDC
  contents: read

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Get OIDC Token
        uses: actions/github-script@v7
        id: token
        with:
          script: |
            const token = await core.getIDToken('https://github.com/myorg')
            core.setSecret(token)
            core.setOutput('token', token)
      
      - name: Mint Credentials
        run: voidkey mint --keys AWS_DEPLOY
        env:
          VOIDKEY_OIDC_TOKEN: ${{ steps.token.outputs.token }}
```

## Auth0

Auth0 is a popular identity-as-a-service platform supporting multiple authentication methods.

### Configuration

```yaml
clientIdps:
  - name: "auth0"
    issuer: "https://myorg.auth0.com/"
    audience: 
      - "https://api.myorg.com"
      - "https://voidkey.myorg.com"
```

### Auth0 Setup

1. **Create Application:**
   - Go to Auth0 Dashboard > Applications
   - Create a "Machine to Machine" application
   - Configure authorized scopes

2. **Configure API:**
   - Create an API in Auth0 Dashboard
   - Set identifier as your audience
   - Configure scopes and permissions

3. **Client Credentials Flow:**
```bash
curl -X POST https://myorg.auth0.com/oauth/token \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "your-client-id",
    "client_secret": "your-client-secret",
    "audience": "https://voidkey.myorg.com",
    "grant_type": "client_credentials"
  }'
```

### Subject Formats

Auth0 subjects depend on the connection type:

```yaml
# Database users
"auth0|507f1f77bcf86cd799439011"

# Social connections
"google-oauth2|103547991597142817347"
"github|12345678"

# Enterprise connections
"samlp|connection-name|user@company.com"
"adfs|connection-name|user@company.com"

# Machine-to-machine
"client-id@clients"  # For client credentials flow
```

### Advanced Configuration

```yaml
clientIdps:
  - name: "auth0"
    issuer: "https://myorg.auth0.com/"
    audience: "https://voidkey.myorg.com"
    
    # Custom JWKS if needed
    jwksUri: "https://myorg.auth0.com/.well-known/jwks.json"
```

## Keycloak

Keycloak is an open-source identity and access management solution.

### Configuration

```yaml
clientIdps:
  - name: "keycloak"
    issuer: "https://auth.example.com/realms/developers"
    audience: "voidkey-client"
```

### Keycloak Setup

1. **Create Realm:**
   - Create or use existing realm
   - Configure realm settings

2. **Create Client:**
```json
{
  "clientId": "voidkey-client",
  "protocol": "openid-connect",
  "publicClient": false,
  "serviceAccountsEnabled": true,
  "standardFlowEnabled": true,
  "directAccessGrantsEnabled": true,
  "validRedirectUris": ["*"],
  "webOrigins": ["*"]
}
```

3. **Configure Client Scopes:**
   - Add "audience" mapper
   - Configure other required claims

4. **Create Service Account:**
   - Enable service accounts for client
   - Assign required roles

### Subject Formats

```yaml
# Regular users (UUID)
"f47ac10b-58cc-4372-a567-0e02b2c3d479"

# Service accounts
"service-account-voidkey-client"

# Custom subject format (if configured)
"user:john.doe@example.com"
```

### Client Credentials Example

```bash
curl -X POST https://auth.example.com/realms/developers/protocol/openid-connect/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=voidkey-client" \
  -d "client_secret=client-secret" \
  -d "grant_type=client_credentials"
```

## Okta

Okta provides enterprise-grade identity management.

### Configuration

```yaml
clientIdps:
  - name: "okta"
    issuer: "https://myorg.okta.com/oauth2/default"
    audience: "api://voidkey"
```

### Okta Setup

1. **Create Authorization Server:**
   - Go to Security > API > Authorization Servers
   - Create custom authorization server
   - Configure audience and scopes

2. **Create Application:**
   - Create "Web" application
   - Configure client credentials
   - Grant required scopes

3. **Configure Claims:**
   - Add custom claims if needed
   - Configure group claims
   - Set up subject claim format

### Subject Formats

```yaml
# Users (Okta user ID)
"00u1a2b3c4d5e6f7g8h9"

# Email-based subjects
"user@company.com"

# Service accounts
"service-account-name"
```

### Token Request Example

```bash
curl -X POST https://myorg.okta.com/oauth2/default/v1/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=your-client-id" \
  -d "client_secret=your-client-secret" \
  -d "grant_type=client_credentials" \
  -d "scope=api://voidkey"
```

## Azure Active Directory

Microsoft Azure AD provides cloud-based identity services.

### Configuration

```yaml
clientIdps:
  - name: "azure-ad"
    issuer: "https://login.microsoftonline.com/tenant-id/v2.0"
    audience: "api://voidkey"
```

### Azure AD Setup

1. **Register Application:**
   - Go to Azure Portal > Azure Active Directory > App registrations
   - Create new registration
   - Configure API permissions

2. **Create Client Secret:**
   - Go to Certificates & secrets
   - Create new client secret
   - Note the secret value

3. **Configure API Permissions:**
   - Add required API permissions
   - Grant admin consent if needed

### Subject Formats

```yaml
# Users (Object ID)
"f47ac10b-58cc-4372-a567-0e02b2c3d479"

# User Principal Name
"user@company.onmicrosoft.com"

# Managed Identity
"managed-identity-object-id"

# Service Principal
"service-principal-object-id"
```

### Token Request Example

```bash
curl -X POST https://login.microsoftonline.com/tenant-id/oauth2/v2.0/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=your-client-id" \
  -d "client_secret=your-client-secret" \
  -d "scope=api://voidkey/.default" \
  -d "grant_type=client_credentials"
```

## Google Workspace

Google Workspace provides identity services for Google-based organizations.

### Configuration

```yaml
clientIdps:
  - name: "google"
    issuer: "https://accounts.google.com"
    audience: "your-google-client-id.apps.googleusercontent.com"
```

### Google Setup

1. **Create Project:**
   - Go to Google Cloud Console
   - Create new project or use existing

2. **Enable APIs:**
   - Enable Google+ API
   - Enable Identity and Access Management API

3. **Create OAuth 2.0 Client:**
   - Go to Credentials > Create Credentials
   - Create OAuth 2.0 client ID
   - Configure authorized domains

### Subject Formats

Google subjects are stable user identifiers:

```yaml
# Google user ID (stable, app-specific)
"103547991597142817347"

# Service account email
"service-account@project.iam.gserviceaccount.com"
```

## GitLab CI

GitLab provides OIDC tokens for CI/CD pipelines.

### Configuration

```yaml
clientIdps:
  - name: "gitlab-ci"
    issuer: "https://gitlab.com"
    audience: "https://gitlab.com/myorg"
```

### Token Claims

GitLab CI tokens include:

| Claim | Description | Example |
|-------|-------------|---------|
| `iss` | GitLab instance | `https://gitlab.com` |
| `aud` | Project or group URL | `https://gitlab.com/myorg` |
| `sub` | Subject format | `project_path:myorg/myapp:ref:main:ref_type:branch` |
| `project_path` | Project path | `myorg/myapp` |
| `ref` | Git reference | `main` |
| `ref_type` | Reference type | `branch` |
| `pipeline_id` | Pipeline ID | `123456789` |

### Subject Formats

```yaml
# Branch pipeline
"project_path:myorg/myapp:ref:main:ref_type:branch"

# Tag pipeline
"project_path:myorg/myapp:ref:v1.0.0:ref_type:tag"

# Merge request
"project_path:myorg/myapp:ref:feature-branch:ref_type:branch"
```

### Usage in GitLab CI

```yaml
# .gitlab-ci.yml
deploy:
  stage: deploy
  script:
    - voidkey mint --keys AWS_DEPLOY
  variables:
    VOIDKEY_OIDC_TOKEN: $CI_JOB_JWT_V2
    VOIDKEY_BROKER_URL: https://broker.example.com
```

## Custom Identity Providers

Create custom identity providers for unsupported IdPs.

### Implementation

```typescript
import { IdpProvider, TokenClaims, JWKSet } from '@voidkey/broker-core';

export class CustomIdpProvider implements IdpProvider {
  name: string;
  issuer: string;
  audience?: string | string[];

  constructor(private config: CustomIdpConfig) {
    this.name = config.name;
    this.issuer = config.issuer;
    this.audience = config.audience;
  }

  async validateToken(token: string): Promise<TokenClaims> {
    // 1. Decode JWT header and payload
    const [header, payload, signature] = token.split('.');
    const headerObj = JSON.parse(atob(header));
    const payloadObj = JSON.parse(atob(payload));

    // 2. Fetch and cache JWKS
    const jwks = await this.getPublicKeys();
    const key = jwks.keys.find(k => k.kid === headerObj.kid);
    
    if (!key) {
      throw new Error('Key not found');
    }

    // 3. Verify signature
    const isValid = await this.verifySignature(token, key);
    if (!isValid) {
      throw new Error('Invalid signature');
    }

    // 4. Validate claims
    await this.validateClaims(payloadObj);

    // 5. Return standardized claims
    return {
      issuer: payloadObj.iss,
      subject: payloadObj.sub,
      audience: payloadObj.aud,
      expiresAt: new Date(payloadObj.exp * 1000),
      issuedAt: new Date(payloadObj.iat * 1000),
      notBefore: payloadObj.nbf ? new Date(payloadObj.nbf * 1000) : undefined,
      customClaims: this.extractCustomClaims(payloadObj)
    };
  }

  async getPublicKeys(): Promise<JWKSet> {
    // Fetch JWKS from IdP
    const jwksUri = this.config.jwksUri || `${this.issuer}/.well-known/jwks.json`;
    
    const response = await fetch(jwksUri);
    if (!response.ok) {
      throw new Error(`Failed to fetch JWKS: ${response.statusText}`);
    }

    return response.json();
  }

  private async verifySignature(token: string, key: any): Promise<boolean> {
    // Implement signature verification using the public key
    // This depends on the algorithm (RS256, ES256, etc.)
    return true; // Placeholder
  }

  private async validateClaims(payload: any): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    // Check expiration
    if (payload.exp <= now) {
      throw new Error('Token expired');
    }

    // Check not before
    if (payload.nbf && payload.nbf > now) {
      throw new Error('Token not yet valid');
    }

    // Check issuer
    if (payload.iss !== this.issuer) {
      throw new Error('Invalid issuer');
    }

    // Check audience if configured
    if (this.audience) {
      const audiences = Array.isArray(this.audience) ? this.audience : [this.audience];
      const tokenAudiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
      
      const hasValidAudience = audiences.some(aud => 
        tokenAudiences.includes(aud)
      );
      
      if (!hasValidAudience) {
        throw new Error('Invalid audience');
      }
    }
  }

  private extractCustomClaims(payload: any): Record<string, any> {
    // Extract non-standard claims specific to this IdP
    const standardClaims = ['iss', 'sub', 'aud', 'exp', 'iat', 'nbf', 'jti'];
    const customClaims: Record<string, any> = {};

    for (const [key, value] of Object.entries(payload)) {
      if (!standardClaims.includes(key)) {
        customClaims[key] = value;
      }
    }

    return customClaims;
  }
}
```

### Registration

```typescript
// Register custom provider in broker startup
import { CustomIdpProvider } from './custom-idp.provider';

const customProvider = new CustomIdpProvider({
  name: 'custom-idp',
  issuer: 'https://custom-idp.example.com',
  audience: 'voidkey-audience',
  jwksUri: 'https://custom-idp.example.com/.well-known/jwks.json'
});

// Register with provider registry
providerRegistry.registerIdpProvider('custom-idp', customProvider);
```

### Configuration

```yaml
clientIdps:
  - name: "custom-idp"
    issuer: "https://custom-idp.example.com"
    audience: "voidkey-audience"
    # Custom provider will be automatically used
```

## Best Practices

### Security

1. **Use HTTPS Only:**
   ```yaml
   # Good
   issuer: "https://secure-idp.example.com"
   
   # Bad
   issuer: "http://idp.example.com"
   ```

2. **Validate Audiences:**
   ```yaml
   # Specific audience
   audience: "https://voidkey.myorg.com"
   
   # Multiple specific audiences
   audience:
     - "https://voidkey.myorg.com"
     - "https://api.myorg.com"
   ```

3. **Regular Key Rotation:**
   - IdPs should rotate signing keys regularly
   - Monitor for key rotation events
   - Cache JWKS with appropriate TTL

### Performance

1. **JWKS Caching:**
   - Cache JWKS responses for 1-24 hours
   - Implement cache invalidation on key rotation
   - Use ETags for efficient caching

2. **Token Validation:**
   - Validate token format before signature verification
   - Cache validation results for duplicate tokens
   - Implement request deduplication

### Monitoring

1. **Token Metrics:**
   - Track token validation success/failure rates
   - Monitor token expiration times
   - Alert on unusual subject patterns

2. **IdP Health:**
   - Monitor JWKS endpoint availability
   - Track response times
   - Alert on IdP certificate changes

## Troubleshooting

### Common Issues

**"Invalid issuer" errors:**
- Verify issuer URL matches exactly
- Check for trailing slashes
- Ensure HTTPS is used

**"Invalid signature" errors:**
- Check JWKS endpoint accessibility
- Verify key ID (kid) matches
- Ensure clock synchronization

**"Token expired" errors:**
- Check token expiration time
- Verify system clock accuracy
- Implement token refresh logic

**"Invalid audience" errors:**
- Check audience claim in token
- Verify broker configuration
- Consider case sensitivity

### Debug Commands

```bash
# Decode token claims
echo "$TOKEN" | cut -d. -f2 | base64 -d | jq .

# Check IdP configuration
curl https://idp.example.com/.well-known/openid-configuration

# Validate JWKS
curl https://idp.example.com/.well-known/jwks.json | jq .
```

## Next Steps

- [Access Providers](/providers/access/) - Configure cloud providers
- [Configuration Examples](/configuration/examples/) - Real-world setups
- [API Authentication](/api/authentication/) - Token usage in API calls
- [GitHub Actions Example](/examples/github-actions/) - Complete integration guide