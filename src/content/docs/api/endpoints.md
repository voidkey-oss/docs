---
title: API Endpoints
description: Detailed documentation of all Voidkey API endpoints
---

This page provides detailed documentation for all Voidkey broker API endpoints.

## Base Information

- **Base URL**: `https://your-broker.example.com`
- **Content Type**: `application/json`
- **Authentication**: Bearer token (OIDC) in Authorization header
- **API Version**: v1 (current)

## Endpoints Overview

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/credentials/mint` | Mint temporary credentials | Yes |
| GET | `/credentials/keys` | List available keys | Yes |
| GET | `/credentials/idp-providers` | List identity providers | No |
| GET | `/health` | Health check | No |

## POST /credentials/mint

Mint temporary credentials for the specified keys.

### Request

```http
POST /credentials/mint HTTP/1.1
Host: broker.example.com
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
Content-Type: application/json

{
  "keys": ["AWS_DEPLOY", "GCP_READONLY"]
}
```

### Request Schema

```json
{
  "type": "object",
  "properties": {
    "oidcToken": {
      "type": "string",
      "description": "OIDC token (alternative to Authorization header)"
    },
    "keys": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Array of key names to mint",
      "minItems": 1,
      "maxItems": 10
    }
  },
  "required": ["keys"],
  "additionalProperties": false
}
```

### Response Schema

```json
{
  "type": "object",
  "properties": {
    "credentials": {
      "type": "object",
      "description": "Map of key names to credential objects"
    },
    "expiresAt": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp when credentials expire"
    },
    "subject": {
      "type": "string",
      "description": "Subject claim from the OIDC token"
    },
    "issuedAt": {
      "type": "string",
      "format": "date-time",
      "description": "ISO 8601 timestamp when credentials were issued"
    }
  },
  "required": ["credentials", "expiresAt", "subject", "issuedAt"]
}
```

### Examples

**AWS Credentials Response:**
```json
{
  "credentials": {
    "AWS_DEPLOY": {
      "AWS_ACCESS_KEY_ID": "ASIATESTACCESSKEY",
      "AWS_SECRET_ACCESS_KEY": "wJalrXUtnFEMI/K7MDENG/bPxRfiCY",
      "AWS_SESSION_TOKEN": "FwoGZXIvYXdzEBYaD...",
      "AWS_REGION": "us-east-1"
    }
  },
  "expiresAt": "2024-01-15T11:00:00Z",
  "subject": "repo:myorg/myapp:ref:refs/heads/main",
  "issuedAt": "2024-01-15T10:00:00Z"
}
```

**Multi-Provider Response:**
```json
{
  "credentials": {
    "AWS_DEPLOY": {
      "AWS_ACCESS_KEY_ID": "ASIATESTACCESSKEY",
      "AWS_SECRET_ACCESS_KEY": "wJalrXUtnFEMI/K7MDENG/bPxRfiCY",
      "AWS_SESSION_TOKEN": "FwoGZXIvYXdzEBYaD..."
    },
    "GCP_READONLY": {
      "GOOGLE_OAUTH_ACCESS_TOKEN": "ya29.A0ARrdaM...",
      "GOOGLE_TOKEN_EXPIRY": "2024-01-15T11:00:00Z",
      "GOOGLE_PROJECT_ID": "my-project-123"
    },
    "MINIO_STORAGE": {
      "MINIO_ACCESS_KEY": "minioadmin",
      "MINIO_SECRET_KEY": "minioadmin123",
      "MINIO_SESSION_TOKEN": "temp-token",
      "MINIO_ENDPOINT": "https://minio.example.com"
    }
  },
  "expiresAt": "2024-01-15T11:00:00Z",
  "subject": "repo:myorg/myapp:ref:refs/heads/main",
  "issuedAt": "2024-01-15T10:00:00Z"
}
```

### Error Responses

**400 Bad Request - Invalid Keys:**
```json
{
  "error": "INVALID_REQUEST",
  "message": "Invalid keys array",
  "details": {
    "field": "keys",
    "issues": [
      "Key 'INVALID_KEY' is not valid",
      "Maximum 10 keys allowed"
    ]
  }
}
```

**401 Unauthorized:**
```json
{
  "error": "UNAUTHORIZED",
  "message": "Invalid or expired OIDC token",
  "details": {
    "reason": "token_expired",
    "expiredAt": "2024-01-15T09:30:00Z"
  }
}
```

**403 Forbidden:**
```json
{
  "error": "FORBIDDEN",
  "message": "Subject does not have access to requested keys",
  "details": {
    "subject": "repo:myorg/myapp:ref:refs/heads/feature",
    "deniedKeys": ["AWS_PROD_DEPLOY"],
    "allowedKeys": ["AWS_DEV_DEPLOY"]
  }
}
```

**404 Not Found:**
```json
{
  "error": "NOT_FOUND",
  "message": "Keys not found for subject",
  "details": {
    "subject": "unknown-subject",
    "missingKeys": ["UNKNOWN_KEY"]
  }
}
```

**500 Internal Server Error:**
```json
{
  "error": "CREDENTIAL_MINT_FAILED",
  "message": "Failed to mint credentials from provider",
  "details": {
    "provider": "aws-prod",
    "key": "AWS_DEPLOY",
    "reason": "assume_role_failed"
  },
  "requestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

## GET /credentials/keys

List all keys available to the authenticated subject.

### Request

```http
GET /credentials/keys HTTP/1.1
Host: broker.example.com
Authorization: Bearer eyJhbGciOiJSUzI1NiIs...
```

Alternative with query parameter:
```http
GET /credentials/keys?token=eyJhbGciOiJSUzI1NiIs... HTTP/1.1
Host: broker.example.com
```

### Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | string | No* | OIDC token (if not in Authorization header) |

*Required if Authorization header is not provided

### Response Schema

```json
{
  "type": "object",
  "properties": {
    "subject": {
      "type": "string",
      "description": "Subject claim from the token"
    },
    "idp": {
      "type": "string",
      "description": "Identity provider name"
    },
    "keys": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "description": "Key identifier"
          },
          "provider": {
            "type": "string",
            "description": "Access provider name"
          },
          "description": {
            "type": "string",
            "description": "Human-readable description"
          },
          "maxDuration": {
            "type": "integer",
            "description": "Maximum session duration in seconds"
          }
        }
      }
    }
  }
}
```

### Example Response

```json
{
  "subject": "repo:myorg/myapp:ref:refs/heads/main",
  "idp": "github-actions",
  "keys": [
    {
      "name": "AWS_PROD_DEPLOY",
      "provider": "aws-prod",
      "description": "AWS production deployment credentials",
      "maxDuration": 3600
    },
    {
      "name": "GCP_ANALYTICS",
      "provider": "gcp-analytics",
      "description": "GCP BigQuery read access",
      "maxDuration": 7200
    },
    {
      "name": "MINIO_STORAGE",
      "provider": "minio-prod",
      "description": "MinIO object storage access",
      "maxDuration": 1800
    }
  ]
}
```

### Error Responses

**401 Unauthorized:**
```json
{
  "error": "UNAUTHORIZED",
  "message": "Missing or invalid authentication token"
}
```

**404 Not Found:**
```json
{
  "error": "SUBJECT_NOT_FOUND",
  "message": "No configuration found for subject",
  "details": {
    "subject": "unknown-subject",
    "idp": "github-actions"
  }
}
```

## GET /credentials/idp-providers

List all configured identity providers. This endpoint does not require authentication.

### Request

```http
GET /credentials/idp-providers HTTP/1.1
Host: broker.example.com
```

### Response Schema

```json
{
  "type": "object",
  "properties": {
    "providers": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {
            "type": "string",
            "description": "Provider name"
          },
          "issuer": {
            "type": "string",
            "description": "OIDC issuer URL"
          },
          "type": {
            "type": "string",
            "description": "Provider type (always 'oidc')"
          }
        }
      }
    }
  }
}
```

### Example Response

```json
{
  "providers": [
    {
      "name": "github-actions",
      "issuer": "https://token.actions.githubusercontent.com",
      "type": "oidc"
    },
    {
      "name": "auth0-dev",
      "issuer": "https://dev.myorg.auth0.com/",
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

## GET /health

Health check endpoint for monitoring and load balancers.

### Request

```http
GET /health HTTP/1.1
Host: broker.example.com
```

### Response Schema

```json
{
  "type": "object",
  "properties": {
    "status": {
      "type": "string",
      "enum": ["healthy", "unhealthy"],
      "description": "Overall health status"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time",
      "description": "Health check timestamp"
    },
    "version": {
      "type": "string",
      "description": "Application version"
    },
    "uptime": {
      "type": "integer",
      "description": "Uptime in seconds"
    },
    "checks": {
      "type": "object",
      "description": "Individual health check results"
    },
    "errors": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Error messages (only when unhealthy)"
    }
  }
}
```

### Healthy Response (200 OK)

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "0.8.0",
  "uptime": 3600,
  "checks": {
    "broker_idp": "healthy",
    "config": "healthy",
    "memory": "healthy",
    "database": "healthy"
  }
}
```

### Unhealthy Response (503 Service Unavailable)

```json
{
  "status": "unhealthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "0.8.0",
  "uptime": 3600,
  "checks": {
    "broker_idp": "unhealthy",
    "config": "healthy",
    "memory": "healthy",
    "database": "unhealthy"
  },
  "errors": [
    "Cannot connect to broker IdP at https://auth.example.com",
    "Database connection timeout"
  ]
}
```

## Rate Limiting

All endpoints (except `/health`) are subject to rate limiting:

### Rate Limit Headers

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1705316400
X-RateLimit-Window: 60
```

### Rate Limit Exceeded (429)

```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Please retry after 60 seconds",
  "retryAfter": 60,
  "details": {
    "limit": 100,
    "window": 60,
    "resetAt": "2024-01-15T10:31:00Z"
  }
}
```

## CORS Support

The API supports CORS for browser-based clients:

### Preflight Request

```http
OPTIONS /credentials/mint HTTP/1.1
Host: broker.example.com
Origin: https://app.example.com
Access-Control-Request-Method: POST
Access-Control-Request-Headers: authorization,content-type
```

### Preflight Response

```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: https://app.example.com
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: authorization, content-type, x-request-id
Access-Control-Max-Age: 86400
Access-Control-Allow-Credentials: true
```

## Error Handling

### Standard Error Format

All errors follow the same JSON structure:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {
    "additional": "context-specific details"
  },
  "requestId": "correlation-id-for-tracing",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `INVALID_REQUEST` | 400 | Malformed request or validation error |
| `UNAUTHORIZED` | 401 | Missing, invalid, or expired authentication |
| `FORBIDDEN` | 403 | Authenticated but not authorized |
| `NOT_FOUND` | 404 | Requested resource does not exist |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Unexpected server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

## API Versioning

Currently, the API is unversioned (v1 implicit). Future versions will use URL path versioning:

```
https://broker.example.com/v2/credentials/mint
```

Version support policy:
- Current version: Fully supported
- Previous version: Supported for 12 months after new version release
- Deprecated versions: 6 months notice before removal

## Next Steps

- [REST API Overview](/api/rest/) - API usage guide
- [Authentication](/api/authentication/) - Authentication methods
- [CLI Commands](/cli/commands/) - Using the CLI client
- [Examples](/examples/github-actions/) - Integration examples