---
title: Identity Providers Configuration
description: Configure identity providers for client authentication
---

This guide covers configuring identity providers (IdPs) that clients can use to authenticate with Voidkey.

## Supported Identity Providers

Voidkey supports any OIDC-compliant identity provider. Here are the pre-built providers:

- **GitHub Actions** - Native GitHub Actions OIDC tokens
- **Auth0** - SaaS identity platform
- **Keycloak** - Open-source identity and access management
- **Okta** - Enterprise identity provider
- **Azure AD** - Microsoft identity platform
- **Google Workspace** - Google identity services

## Basic Configuration

Client IdPs are configured in the `clientIdps` section:

```yaml
clientIdps:
  - name: "github-actions"
    issuer: "https://token.actions.githubusercontent.com"
    audience: "https://github.com/myorg"
```

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Unique identifier for the IdP |
| `issuer` | string | OIDC issuer URL |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `audience` | string \| string[] | Expected audience claims |
| `jwksUri` | string | Custom JWKS endpoint (overrides issuer) |
| `tokenEndpoint` | string | Custom token endpoint |
| `userInfoEndpoint` | string | Custom user info endpoint |

## GitHub Actions

Configure GitHub Actions OIDC for CI/CD workflows:

```yaml
clientIdps:
  - name: "github-actions"
    issuer: "https://token.actions.githubusercontent.com"
    audience: "https://github.com/myorg"  # Your GitHub org/user
```

### GitHub Subject Format

GitHub Actions tokens have subjects in this format:
- Repository: `repo:owner/repo:ref:refs/heads/branch`
- Environment: `repo:owner/repo:environment:env_name`
- Pull Request: `repo:owner/repo:pull_request`

### Example Identity Mapping

```yaml
clientIdentities:
  # Main branch deployments
  - subject: "repo:myorg/myapp:ref:refs/heads/main"
    idp: "github-actions"
    keys:
      PROD_DEPLOY: ...
  
  # Staging branch
  - subject: "repo:myorg/myapp:ref:refs/heads/staging"
    idp: "github-actions"
    keys:
      STAGING_DEPLOY: ...
  
  # Environment-based
  - subject: "repo:myorg/myapp:environment:production"
    idp: "github-actions"
    keys:
      PROD_DEPLOY: ...
```

### GitHub Workflow Setup

```yaml
# .github/workflows/deploy.yml
permissions:
  id-token: write  # Required for OIDC

jobs:
  deploy:
    steps:
      - name: Get OIDC token
        uses: actions/github-script@v7
        id: get-token
        with:
          script: |
            const token = await core.getIDToken('https://github.com/myorg')
            core.setSecret(token)
            core.setOutput('token', token)
      
      - name: Use Voidkey
        env:
          VOIDKEY_OIDC_TOKEN: ${{ steps.get-token.outputs.token }}
        run: voidkey mint --keys PROD_DEPLOY
```

## Auth0

Configure Auth0 for user and application authentication:

```yaml
clientIdps:
  - name: "auth0"
    issuer: "https://myorg.auth0.com/"
    audience: 
      - "https://api.myorg.com"
      - "https://voidkey.myorg.com"
```

### Auth0 Subject Format

Auth0 subjects depend on the connection type:
- Database users: `auth0|user_id`
- Social logins: `google-oauth2|user_id`
- Enterprise: `samlp|connection|user_id`

### Example Configuration

```yaml
clientIdentities:
  # Individual users
  - subject: "auth0|64abc123def456789"
    idp: "auth0"
    keys:
      DEV_ACCESS: ...
  
  # Machine-to-machine
  - subject: "service-account@myorg.iam.gserviceaccount.com"
    idp: "auth0"
    keys:
      API_ACCESS: ...
```

### Auth0 Application Setup

1. Create a Machine to Machine application
2. Configure allowed audiences
3. Enable OIDC Conformant
4. Set token lifetime appropriately

## Keycloak

Configure Keycloak for open-source identity management:

```yaml
clientIdps:
  - name: "keycloak"
    issuer: "https://auth.example.com/realms/developers"
    audience: "voidkey-client"
    
    # Optional: Custom JWKS if different from standard
    jwksUri: "https://auth.example.com/realms/developers/protocol/openid-connect/certs"
```

### Keycloak Subject Format

Keycloak subjects are typically UUIDs:
- Users: UUID (e.g., `f47ac10b-58cc-4372-a567-0e02b2c3d479`)
- Service accounts: `service-account-client-name`

### Keycloak Client Configuration

1. Create a new client in your realm
2. Set Access Type to "confidential" 
3. Enable "Service Accounts Enabled"
4. Configure Valid Redirect URIs
5. Set audience in client mappers

```json
{
  "clientId": "voidkey-client",
  "protocol": "openid-connect",
  "publicClient": false,
  "serviceAccountsEnabled": true,
  "standardFlowEnabled": true,
  "protocolMappers": [
    {
      "name": "audience",
      "protocol": "openid-connect",
      "protocolMapper": "oidc-audience-mapper",
      "config": {
        "included.client.audience": "voidkey-client",
        "id.token.claim": "false",
        "access.token.claim": "true"
      }
    }
  ]
}
```

## Okta

Configure Okta for enterprise identity:

```yaml
clientIdps:
  - name: "okta"
    issuer: "https://myorg.okta.com/oauth2/default"
    audience: "api://voidkey"
```

### Okta Subject Format

- Users: Okta user ID or email
- Service accounts: Application client ID

### Okta Application Setup

1. Create a Web application
2. Configure OIDC settings
3. Set up custom authorization server
4. Configure API scopes and claims

## Azure Active Directory

Configure Azure AD for Microsoft-based identity:

```yaml
clientIdps:
  - name: "azure-ad"
    issuer: "https://login.microsoftonline.com/tenant-id/v2.0"
    audience: "api://voidkey"
```

### Azure Subject Format

- Users: Object ID or UPN
- Managed identities: Object ID
- Service principals: Application ID

### Azure App Registration

1. Register application in Azure AD
2. Configure API permissions
3. Create client secret
4. Set up custom scopes

## Google Workspace

Configure Google Workspace for Google-based identity:

```yaml
clientIdps:
  - name: "google"
    issuer: "https://accounts.google.com"
    audience: "your-google-client-id.apps.googleusercontent.com"
```

### Google Subject Format

Google subjects are stable user identifiers specific to your application.

## Advanced Configuration

### Multiple Audiences

Support multiple audiences for a single IdP:

```yaml
clientIdps:
  - name: "multi-audience-idp"
    issuer: "https://idp.example.com"
    audience:
      - "https://api.example.com"
      - "https://voidkey.example.com"
      - "urn:example:api"
```

### Custom JWKS Endpoints

Override JWKS discovery for non-standard setups:

```yaml
clientIdps:
  - name: "custom-idp"
    issuer: "https://idp.example.com"
    jwksUri: "https://keys.example.com/.well-known/jwks.json"
```

### Audience Validation Options

```yaml
clientIdps:
  # Strict validation (recommended)
  - name: "strict-idp"
    issuer: "https://idp.example.com"
    audience: "https://api.example.com"
  
  # Multiple allowed audiences
  - name: "flexible-idp"
    issuer: "https://idp.example.com"
    audience:
      - "https://api.example.com"
      - "https://voidkey.example.com"
  
  # Skip audience validation (not recommended)
  - name: "permissive-idp"
    issuer: "https://idp.example.com"
    # No audience field = skip validation
```

## Custom Identity Providers

Create custom providers for unsupported IdPs:

```typescript
// Custom IdP provider implementation
import { IdpProvider, TokenClaims } from '@voidkey/broker-core';

export class CustomIdpProvider implements IdpProvider {
  constructor(private config: CustomIdpConfig) {}

  async validateToken(token: string): Promise<TokenClaims> {
    // 1. Decode JWT
    // 2. Fetch JWKS
    // 3. Verify signature
    // 4. Validate claims
    // 5. Return standardized claims
  }

  async getPublicKeys(): Promise<JWKSet> {
    // Fetch public keys from IdP
  }
}
```

Register custom provider:

```typescript
// In broker server startup
const customProvider = new CustomIdpProvider(config);
providerRegistry.registerIdpProvider('custom', customProvider);
```

## Security Considerations

### Token Validation

Voidkey validates tokens according to RFC 7519 and OpenID Connect:

1. **Signature Verification**: Using JWKS public keys
2. **Issuer Validation**: Must match configured issuer
3. **Audience Validation**: Must contain expected audience
4. **Expiration**: Token must not be expired
5. **Not Before**: Token must be valid now
6. **Issued At**: Token must not be issued in the future

### Best Practices

1. **Use Specific Audiences**
   ```yaml
   # Good
   audience: "https://voidkey.myorg.com"
   
   # Avoid
   audience: "*"
   ```

2. **Validate Issuers Carefully**
   ```yaml
   # Ensure HTTPS
   issuer: "https://secure-idp.example.com"
   ```

3. **Monitor Token Claims**
   ```yaml
   # Log unusual subjects or claims
   logging:
     audit: true
     level: info
   ```

4. **Rotate JWKS Keys**
   - IdPs should rotate signing keys regularly
   - Voidkey caches JWKS with appropriate TTL
   - Monitor for key rotation events

## Troubleshooting

### Common Issues

**"Invalid token signature"**
- Check JWKS endpoint accessibility
- Verify key ID (kid) matches
- Ensure clock synchronization

**"Invalid audience"**
- Check audience claim in token
- Verify broker configuration
- Consider multiple audience support

**"Token expired"**
- OIDC tokens are typically short-lived
- Check token expiration time
- Ensure minimal delay between issue and use

**"Issuer not found"**
- Verify HTTPS connectivity to IdP
- Check `.well-known/openid-configuration` endpoint
- Validate issuer URL format

### Debug Token Claims

Use the CLI to inspect token claims:

```bash
# Decode token claims
voidkey validate --token "$OIDC_TOKEN" --verbose

# Check specific claims
echo "$OIDC_TOKEN" | cut -d. -f2 | base64 -d | jq .
```

### Test IdP Connectivity

```bash
# Check OIDC discovery
curl https://idp.example.com/.well-known/openid-configuration

# Check JWKS endpoint
curl https://idp.example.com/.well-known/jwks.json

# Verify certificate
openssl s_client -connect idp.example.com:443 -servername idp.example.com
```

## Next Steps

- [Access Providers](/configuration/access-providers/) - Configure cloud providers
- [Configuration Examples](/configuration/examples/) - Real-world configurations
- [GitHub Actions Example](/examples/github-actions/) - Detailed GitHub integration
- [Security Model](/architecture/security/) - Security implications