---
title: API Authentication
description: Authentication methods and security for Voidkey API
---

This guide covers how authentication works with the Voidkey API and the various ways to provide authentication tokens.

## Authentication Overview

The Voidkey API uses **OIDC (OpenID Connect) tokens** for authentication. These tokens are issued by configured identity providers and validated by the broker before granting access to credentials.

## Authentication Flow

```mermaid
sequenceDiagram
    participant Client
    participant IdP as Identity<br/>Provider
    participant Broker as Voidkey<br/>Broker
    participant Cloud as Cloud<br/>Provider

    Client->>IdP: 1. Authenticate & request token
    IdP->>Client: 2. OIDC token
    
    Client->>Broker: 3. API request with token
    
    Broker->>IdP: 4. Validate token (JWKS)
    IdP->>Broker: 5. Token valid + claims
    
    Broker->>Cloud: 6. Request credentials
    Cloud->>Broker: 7. Temporary credentials
    
    Broker->>Client: 8. Credentials response
```

## Providing Authentication Tokens

### 1. Authorization Header (Recommended)

The preferred method is to include the OIDC token in the `Authorization` header:

```http
GET /credentials/keys HTTP/1.1
Host: broker.example.com
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

**Benefits:**
- Standard HTTP authentication method
- Automatically handled by most HTTP libraries
- Not logged in access logs (unlike query parameters)
- Works with all endpoints

### 2. Request Body (POST only)

For POST requests, you can include the token in the request body:

```http
POST /credentials/mint HTTP/1.1
Host: broker.example.com
Content-Type: application/json

{
  "oidcToken": "eyJhbGciOiJSUzI1NiIs...",
  "keys": ["AWS_DEPLOY"]
}
```

**When to use:**
- When you cannot modify HTTP headers
- Legacy integrations
- Certain client libraries

### 3. Query Parameter (GET only)

For GET requests, you can pass the token as a query parameter:

```http
GET /credentials/keys?token=eyJhbGciOiJSUzI1NiIs... HTTP/1.1
Host: broker.example.com
```

**Caution:**
- May be logged in server access logs
- Visible in browser history
- Limited URL length
- Only use when other methods aren't available

## Token Validation Process

When you make an API request, the broker validates your token through these steps:

### 1. Token Extraction

The broker extracts the token from:
1. `Authorization: Bearer <token>` header (first priority)
2. `token` query parameter (GET requests)
3. `oidcToken` field in request body (POST requests)

### 2. Token Structure Validation

```javascript
// Token must be a valid JWT with three parts
const [header, payload, signature] = token.split('.');

// Header must specify algorithm and key ID
const headerObj = JSON.parse(base64Decode(header));
// Required: alg, kid (if multiple keys)

// Payload must contain required claims
const payloadObj = JSON.parse(base64Decode(payload));
// Required: iss, aud, sub, exp, iat
```

### 3. Signature Verification

```javascript
// 1. Fetch JWKS from IdP
const jwks = await fetch(`${issuer}/.well-known/jwks.json`);

// 2. Find matching key
const key = jwks.keys.find(k => k.kid === header.kid);

// 3. Verify signature
const isValid = crypto.verify(algorithm, message, signature, key);
```

### 4. Claims Validation

```javascript
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
if (payload.iss !== expectedIssuer) {
  throw new Error('Invalid issuer');
}

// Check audience
if (!payload.aud.includes(expectedAudience)) {
  throw new Error('Invalid audience');
}
```

## Token Requirements

### Required Claims

Your OIDC token must contain these standard claims:

| Claim | Description | Example |
|-------|-------------|---------|
| `iss` | Token issuer | `https://token.actions.githubusercontent.com` |
| `aud` | Intended audience | `https://github.com/myorg` |
| `sub` | Subject identifier | `repo:myorg/myapp:ref:refs/heads/main` |
| `exp` | Expiration time | `1705318200` (Unix timestamp) |
| `iat` | Issued at time | `1705314600` (Unix timestamp) |

### Optional Claims

These claims may be present and used for additional validation:

| Claim | Description | Example |
|-------|-------------|---------|
| `nbf` | Not before time | `1705314600` |
| `jti` | JWT ID (unique identifier) | `uuid-string` |
| `azp` | Authorized party | `client-id` |

### Subject Format Examples

The `sub` claim format depends on your identity provider:

**GitHub Actions:**
```
repo:owner/repository:ref:refs/heads/branch
repo:owner/repository:environment:environment_name
repo:owner/repository:pull_request
```

**Auth0:**
```
auth0|user_id
google-oauth2|user_id
samlp|connection|user_id
```

**Keycloak:**
```
f47ac10b-58cc-4372-a567-0e02b2c3d479  # User UUID
service-account-client-name            # Service account
```

## Common Authentication Scenarios

### GitHub Actions

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
      
      - name: Call Voidkey API
        run: |
          curl -H "Authorization: Bearer ${{ steps.get-token.outputs.token }}" \
               https://broker.example.com/credentials/keys
```

### CLI Tools

```bash
# Using environment variable
export VOIDKEY_OIDC_TOKEN="$(get-token-command)"
curl -H "Authorization: Bearer $VOIDKEY_OIDC_TOKEN" \
     https://broker.example.com/credentials/keys

# Using query parameter
TOKEN="$(get-token-command)"
curl "https://broker.example.com/credentials/keys?token=$TOKEN"
```

### Service Accounts

```javascript
// Node.js example with service account
const { OAuth2Client } = require('google-auth-library');

async function getOIDCToken() {
  const client = new OAuth2Client();
  const url = 'https://voidkey.example.com';
  const audience = 'https://github.com/myorg';
  
  const token = await client.fetchIdToken({
    targetAudience: audience,
    serviceAccountEmail: 'service@project.iam.gserviceaccount.com'
  });
  
  return token;
}

async function callVoidkeyAPI() {
  const token = await getOIDCToken();
  
  const response = await fetch('https://broker.example.com/credentials/keys', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  
  return response.json();
}
```

## Token Caching and Refresh

### Client-Side Caching

OIDC tokens are typically short-lived (5-15 minutes). Implement proper caching:

```javascript
class TokenCache {
  constructor() {
    this.token = null;
    this.expiresAt = null;
  }
  
  async getValidToken() {
    // Check if current token is still valid
    if (this.token && this.expiresAt > Date.now() + 60000) { // 1 minute buffer
      return this.token;
    }
    
    // Fetch new token
    this.token = await this.fetchNewToken();
    
    // Parse expiration from JWT
    const payload = JSON.parse(atob(this.token.split('.')[1]));
    this.expiresAt = payload.exp * 1000;
    
    return this.token;
  }
  
  async fetchNewToken() {
    // Implementation depends on your IdP
    // GitHub Actions: core.getIDToken()
    // Auth0: client credentials flow
    // etc.
  }
}
```

### Server-Side Considerations

**Don't cache tokens server-side** - they're meant to be short-lived and client-specific.

## Authentication Errors

### Common Error Responses

**Missing Token (401):**
```json
{
  "error": "UNAUTHORIZED",
  "message": "Missing authentication token",
  "details": {
    "reason": "no_token_provided"
  }
}
```

**Invalid Token Format (401):**
```json
{
  "error": "UNAUTHORIZED", 
  "message": "Invalid token format",
  "details": {
    "reason": "malformed_jwt"
  }
}
```

**Token Expired (401):**
```json
{
  "error": "UNAUTHORIZED",
  "message": "Token has expired",
  "details": {
    "reason": "token_expired",
    "expiredAt": "2024-01-15T10:30:00Z",
    "currentTime": "2024-01-15T10:35:00Z"
  }
}
```

**Invalid Signature (401):**
```json
{
  "error": "UNAUTHORIZED",
  "message": "Token signature verification failed",
  "details": {
    "reason": "invalid_signature",
    "issuer": "https://token.actions.githubusercontent.com"
  }
}
```

**Invalid Issuer (401):**
```json
{
  "error": "UNAUTHORIZED",
  "message": "Token issuer not configured",
  "details": {
    "reason": "unknown_issuer", 
    "issuer": "https://unknown-idp.com",
    "configuredIssuers": [
      "https://token.actions.githubusercontent.com",
      "https://auth0.example.com/"
    ]
  }
}
```

**Invalid Audience (401):**
```json
{
  "error": "UNAUTHORIZED",
  "message": "Token audience validation failed",
  "details": {
    "reason": "invalid_audience",
    "tokenAudience": ["https://wrong-audience.com"],
    "expectedAudience": ["https://github.com/myorg"]
  }
}
```

## Security Best Practices

### 1. Use HTTPS Only

```bash
# Good
curl -H "Authorization: Bearer $TOKEN" https://broker.example.com/...

# Bad - token exposed in plaintext
curl -H "Authorization: Bearer $TOKEN" http://broker.example.com/...
```

### 2. Secure Token Storage

```bash
# Good - environment variable
export VOIDKEY_OIDC_TOKEN="$(secure-token-source)"

# Bad - hardcoded in script
TOKEN="eyJhbGciOiJSUzI1NiIs..."  # Never do this
```

### 3. Token Transmission

```javascript
// Good - Authorization header
fetch('/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Avoid - query parameter (logged, cached, visible)
fetch(`/api/endpoint?token=${token}`);
```

### 4. Validate Token Locally

Before making API calls, validate tokens client-side when possible:

```javascript
function isTokenExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch (e) {
    return true; // Assume expired if can't parse
  }
}

// Check before making API call
if (isTokenExpired(token)) {
  token = await refreshToken();
}
```

### 5. Handle Errors Gracefully

```javascript
async function makeAuthenticatedRequest(url, token) {
  try {
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    
    if (response.status === 401) {
      // Token expired or invalid - refresh and retry
      const newToken = await refreshToken();
      return makeAuthenticatedRequest(url, newToken);
    }
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('Authentication request failed:', error);
    throw error;
  }
}
```

## Testing Authentication

### Local Development

```bash
# Get token from development IdP
DEV_TOKEN=$(curl -s -X POST "http://localhost:8080/realms/client/protocol/openid-connect/token" \
  -d "client_id=test-client" \
  -d "username=test-user" \
  -d "password=test-password" \
  -d "grant_type=password" | jq -r '.access_token')

# Test API endpoint
curl -H "Authorization: Bearer $DEV_TOKEN" \
     http://localhost:3000/credentials/keys
```

### Token Debugging

```bash
# Decode token claims (without verification)
echo "$TOKEN" | cut -d. -f2 | base64 -d | jq .

# Check token expiration
echo "$TOKEN" | cut -d. -f2 | base64 -d | jq '.exp | todateiso'

# Validate token format
[[ "$TOKEN" =~ ^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$ ]] && echo "Valid JWT format"
```

## Next Steps

- [API Endpoints](/api/endpoints/) - Detailed endpoint documentation
- [REST API Overview](/api/rest/) - API usage examples
- [CLI Commands](/cli/commands/) - Using the CLI for authentication
- [GitHub Actions Example](/examples/github-actions/) - OIDC integration example