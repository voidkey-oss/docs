---
title: REST API Reference
description: Complete REST API reference for Voidkey broker
---

The Voidkey broker exposes a RESTful API for credential minting and management.

## Base URL

```
https://voidkey.example.com
```

## Authentication

All API requests require a valid OIDC token from a configured client IdP:

```bash
curl -X POST https://voidkey.example.com/credentials/mint \
  -H "Authorization: Bearer eyJhbGciOiJSUzI1NiIs..." \
  -H "Content-Type: application/json" \
  -d '{"keys": ["AWS_DEPLOY"]}'
```

## Common Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Authorization` | Yes* | Bearer token with OIDC token |
| `Content-Type` | Yes** | `application/json` for POST/PUT |
| `X-Request-ID` | No | Correlation ID for request tracking |

\* Not required for health endpoint  
\** Only for requests with body

## API Endpoints

### POST /credentials/mint

Mint temporary credentials for specified keys.

#### Request

```http
POST /credentials/mint HTTP/1.1
Host: voidkey.example.com
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
Content-Type: application/json

{
  "oidcToken": "eyJhbGciOiJSUzI1NiIs...",
  "keys": ["AWS_DEPLOY", "GCP_READONLY"]
}
```

#### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `oidcToken` | string | No* | OIDC token (if not in Authorization header) |
| `keys` | string[] | Yes | Array of key names to mint |

\* Token must be provided either in Authorization header or request body

#### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json
X-Request-ID: 550e8400-e29b-41d4-a716-446655440000

{
  "credentials": {
    "AWS_DEPLOY": {
      "AWS_ACCESS_KEY_ID": "ASIATESTACCESSKEY",
      "AWS_SECRET_ACCESS_KEY": "wJalrXUtnFEMI/K7MDENG/bPxRfiCY",
      "AWS_SESSION_TOKEN": "FwoGZXIvYXdzEBYaD...",
      "AWS_REGION": "us-east-1"
    },
    "GCP_READONLY": {
      "GOOGLE_OAUTH_ACCESS_TOKEN": "ya29.A0ARrdaM...",
      "GOOGLE_TOKEN_EXPIRY": "2024-01-15T12:00:00Z"
    }
  },
  "expiresAt": "2024-01-15T11:00:00Z",
  "subject": "repo:myorg/myapp:ref:refs/heads/main",
  "issuedAt": "2024-01-15T10:00:00Z"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `credentials` | object | Map of key names to credential values |
| `expiresAt` | string | ISO 8601 timestamp when credentials expire |
| `subject` | string | Subject claim from OIDC token |
| `issuedAt` | string | ISO 8601 timestamp when credentials were issued |

#### Error Responses

**400 Bad Request**
```json
{
  "error": "INVALID_REQUEST",
  "message": "Missing required field: keys",
  "details": {
    "field": "keys",
    "reason": "required"
  }
}
```

**401 Unauthorized**
```json
{
  "error": "UNAUTHORIZED",
  "message": "Invalid or expired token"
}
```

**403 Forbidden**
```json
{
  "error": "FORBIDDEN",
  "message": "Subject 'user:alice@example.com' does not have access to key 'AWS_PROD'"
}
```

**404 Not Found**
```json
{
  "error": "NOT_FOUND",
  "message": "Key 'INVALID_KEY' not found for subject"
}
```

**500 Internal Server Error**
```json
{
  "error": "INTERNAL_ERROR",
  "message": "Failed to mint credentials",
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

### GET /credentials/keys

List available keys for the authenticated subject.

#### Request

```http
GET /credentials/keys?token=eyJhbGciOiJSUzI1NiIs... HTTP/1.1
Host: voidkey.example.com
```

Or with Authorization header:

```http
GET /credentials/keys HTTP/1.1
Host: voidkey.example.com
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

#### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | string | No* | OIDC token (if not in Authorization header) |

#### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "subject": "repo:myorg/myapp:ref:refs/heads/main",
  "idp": "github-actions",
  "keys": [
    {
      "name": "AWS_DEPLOY",
      "provider": "aws-prod",
      "description": "AWS deployment credentials",
      "maxDuration": 3600
    },
    {
      "name": "GCP_READONLY",
      "provider": "gcp-prod",
      "description": "GCP read-only access",
      "maxDuration": 7200
    }
  ]
}
```

### GET /credentials/idp-providers

List configured identity providers.

#### Request

```http
GET /credentials/idp-providers HTTP/1.1
Host: voidkey.example.com
```

#### Response

```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "providers": [
    {
      "name": "github-actions",
      "issuer": "https://token.actions.githubusercontent.com",
      "type": "oidc"
    },
    {
      "name": "auth0-dev",
      "issuer": "https://dev.auth0.com/",
      "type": "oidc"
    },
    {
      "name": "keycloak",
      "issuer": "https://auth.example.com/realms/developers",
      "type": "oidc"
    }
  ]
}
```

### GET /health

Health check endpoint for monitoring and load balancers.

#### Request

```http
GET /health HTTP/1.1
Host: voidkey.example.com
```

#### Response

**Healthy**
```http
HTTP/1.1 200 OK
Content-Type: application/json

{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "0.8.0",
  "uptime": 3600,
  "checks": {
    "broker_idp": "healthy",
    "config": "healthy",
    "memory": "healthy"
  }
}
```

**Unhealthy**
```http
HTTP/1.1 503 Service Unavailable
Content-Type: application/json

{
  "status": "unhealthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "0.8.0",
  "uptime": 3600,
  "checks": {
    "broker_idp": "unhealthy",
    "config": "healthy",
    "memory": "healthy"
  },
  "errors": [
    "Cannot connect to broker IdP"
  ]
}
```

## Rate Limiting

The API implements rate limiting to prevent abuse:

- **Default limit**: 100 requests per minute per IP
- **Burst limit**: 20 requests
- **Headers returned**:
  - `X-RateLimit-Limit`: Maximum requests per window
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Unix timestamp when limit resets

**Rate limit exceeded response:**
```http
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1705316400

{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Please retry after 1705316400",
  "retryAfter": 60
}
```

## CORS Configuration

The API supports CORS for browser-based clients:

```http
OPTIONS /credentials/mint HTTP/1.1
Host: voidkey.example.com
Origin: https://app.example.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: authorization,content-type

HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: authorization, content-type
Access-Control-Max-Age: 86400
```

## Error Response Format

All error responses follow a consistent format:

```typescript
interface ErrorResponse {
  error: string;        // Error code (SCREAMING_SNAKE_CASE)
  message: string;      // Human-readable message
  details?: any;        // Additional error details
  requestId?: string;   // Request correlation ID
  retryAfter?: number;  // Seconds to wait before retry
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Malformed request or missing required fields |
| `INVALID_TOKEN` | 401 | Token validation failed |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Authenticated but not authorized |
| `NOT_FOUND` | 404 | Requested resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server-side error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

## SDK Examples

### JavaScript/TypeScript

```typescript
import axios from 'axios';

class VoidkeyClient {
  constructor(private baseUrl: string) {}

  async mintCredentials(token: string, keys: string[]) {
    const response = await axios.post(
      `${this.baseUrl}/credentials/mint`,
      { keys },
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  }

  async listKeys(token: string) {
    const response = await axios.get(
      `${this.baseUrl}/credentials/keys`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      }
    );
    return response.data;
  }
}

// Usage
const client = new VoidkeyClient('https://voidkey.example.com');
const creds = await client.mintCredentials(oidcToken, ['AWS_DEPLOY']);
```

### Python

```python
import requests
from typing import List, Dict

class VoidkeyClient:
    def __init__(self, base_url: str):
        self.base_url = base_url
        self.session = requests.Session()
    
    def mint_credentials(self, token: str, keys: List[str]) -> Dict:
        response = self.session.post(
            f"{self.base_url}/credentials/mint",
            json={"keys": keys},
            headers={
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
            }
        )
        response.raise_for_status()
        return response.json()
    
    def list_keys(self, token: str) -> Dict:
        response = self.session.get(
            f"{self.base_url}/credentials/keys",
            headers={"Authorization": f"Bearer {token}"}
        )
        response.raise_for_status()
        return response.json()

# Usage
client = VoidkeyClient("https://voidkey.example.com")
creds = client.mint_credentials(oidc_token, ["AWS_DEPLOY"])
```

### Go

```go
package voidkey

import (
    "bytes"
    "encoding/json"
    "fmt"
    "net/http"
)

type Client struct {
    BaseURL string
    HTTP    *http.Client
}

type MintRequest struct {
    Keys []string `json:"keys"`
}

type MintResponse struct {
    Credentials map[string]map[string]string `json:"credentials"`
    ExpiresAt   string                       `json:"expiresAt"`
    Subject     string                       `json:"subject"`
}

func (c *Client) MintCredentials(token string, keys []string) (*MintResponse, error) {
    body, _ := json.Marshal(MintRequest{Keys: keys})
    
    req, err := http.NewRequest("POST", c.BaseURL+"/credentials/mint", bytes.NewReader(body))
    if err != nil {
        return nil, err
    }
    
    req.Header.Set("Authorization", "Bearer "+token)
    req.Header.Set("Content-Type", "application/json")
    
    resp, err := c.HTTP.Do(req)
    if err != nil {
        return nil, err
    }
    defer resp.Body.Close()
    
    if resp.StatusCode != http.StatusOK {
        return nil, fmt.Errorf("unexpected status: %d", resp.StatusCode)
    }
    
    var result MintResponse
    if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
        return nil, err
    }
    
    return &result, nil
}
```

## Best Practices

1. **Token Handling**
   - Always use HTTPS
   - Prefer Authorization header over query parameters
   - Never log tokens

2. **Error Handling**
   - Implement exponential backoff for retries
   - Handle rate limits gracefully
   - Log request IDs for debugging

3. **Performance**
   - Reuse HTTP connections
   - Request only needed keys
   - Cache responses appropriately

4. **Security**
   - Validate certificates
   - Implement request timeouts
   - Sanitize error messages

## Next Steps

- [API Endpoints](/api/endpoints/) - Detailed endpoint documentation
- [Authentication](/api/authentication/) - Authentication methods
- [CLI Reference](/cli/commands/) - Using the CLI client
- [Examples](/examples/cicd/) - Integration examples