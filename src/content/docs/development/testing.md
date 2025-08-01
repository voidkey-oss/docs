---
title: Testing Guide
description: Testing strategies and practices for Voidkey
---

This guide covers testing strategies, tools, and best practices for developing and maintaining Voidkey.

## Testing Architecture

Voidkey uses a comprehensive testing strategy with multiple layers:

```
┌─────────────────────────────────────────┐
│            E2E Tests                    │
│  Full system integration testing        │
├─────────────────────────────────────────┤
│         Integration Tests               │
│  Component integration testing          │
├─────────────────────────────────────────┤
│           Unit Tests                    │
│  Individual function testing            │
└─────────────────────────────────────────┘
```

## Unit Testing

### TypeScript Components (Jest)

Both broker-core and broker-server use Jest for unit testing.

**Running Tests:**
```bash
# broker-core
cd broker-core
npm test
npm run test:watch
npm run test:coverage

# broker-server
cd broker-server
npm test
npm run test:cov
npm run test:debug
```

**Example Unit Test:**
```typescript
// src/providers/idp/__tests__/github-actions.provider.test.ts
import { GitHubActionsProvider } from '../github-actions.provider';

describe('GitHubActionsProvider', () => {
  let provider: GitHubActionsProvider;

  beforeEach(() => {
    provider = new GitHubActionsProvider({
      name: 'github-actions',
      issuer: 'https://token.actions.githubusercontent.com',
      audience: 'https://github.com/myorg'
    });
  });

  describe('validateToken', () => {
    it('should validate a valid GitHub Actions token', async () => {
      const mockToken = createMockGitHubToken({
        sub: 'repo:myorg/myapp:ref:refs/heads/main',
        aud: 'https://github.com/myorg'
      });

      const result = await provider.validateToken(mockToken);

      expect(result.subject).toBe('repo:myorg/myapp:ref:refs/heads/main');
      expect(result.issuer).toBe('https://token.actions.githubusercontent.com');
    });

    it('should reject token with invalid audience', async () => {
      const mockToken = createMockGitHubToken({
        sub: 'repo:myorg/myapp:ref:refs/heads/main',
        aud: 'https://github.com/wrongorg'
      });

      await expect(provider.validateToken(mockToken))
        .rejects.toThrow('Invalid audience');
    });

    it('should reject expired token', async () => {
      const mockToken = createMockGitHubToken({
        sub: 'repo:myorg/myapp:ref:refs/heads/main',
        exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
      });

      await expect(provider.validateToken(mockToken))
        .rejects.toThrow('Token expired');
    });
  });
});

// Test utilities
function createMockGitHubToken(claims: any): string {
  const header = { alg: 'RS256', typ: 'JWT', kid: 'test-key' };
  const payload = {
    iss: 'https://token.actions.githubusercontent.com',
    aud: 'https://github.com/myorg',
    sub: 'repo:myorg/myapp:ref:refs/heads/main',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    ...claims
  };

  // Create mock JWT (in real tests, use proper JWT signing)
  return `${btoa(JSON.stringify(header))}.${btoa(JSON.stringify(payload))}.mock-signature`;
}
```

### Go CLI Testing

The CLI uses Go's built-in testing framework.

**Running Tests:**
```bash
cd cli
go test ./...
go test -v ./cmd
go test -cover ./...
```

**Example CLI Test:**
```go
// cmd/mint_test.go
package cmd

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"github.com/stretchr/testify/assert"
)

func TestMintCommand(t *testing.T) {
	// Mock broker server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		assert.Equal(t, "POST", r.Method)
		assert.Equal(t, "/credentials/mint", r.URL.Path)
		assert.Equal(t, "Bearer test-token", r.Header.Get("Authorization"))

		response := map[string]interface{}{
			"credentials": map[string]interface{}{
				"AWS_DEPLOY": map[string]string{
					"AWS_ACCESS_KEY_ID":     "ASIATESTACCESSKEY",
					"AWS_SECRET_ACCESS_KEY": "testsecretkey",
					"AWS_SESSION_TOKEN":     "testsessiontoken",
				},
			},
			"expiresAt": "2024-01-15T11:00:00Z",
			"subject":   "test-subject",
		}

		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(response)
	}))
	defer server.Close()

	// Test mint command
	cmd := newMintCmd()
	cmd.SetArgs([]string{"--keys", "AWS_DEPLOY", "--broker-url", server.URL, "--token", "test-token"})

	err := cmd.Execute()
	assert.NoError(t, err)
}

func TestMintCommandInvalidToken(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(w).Encode(map[string]string{
			"error":   "UNAUTHORIZED",
			"message": "Invalid token",
		})
	}))
	defer server.Close()

	cmd := newMintCmd()
	cmd.SetArgs([]string{"--keys", "AWS_DEPLOY", "--broker-url", server.URL, "--token", "invalid-token"})

	err := cmd.Execute()
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "Invalid token")
}
```

## Integration Testing

Integration tests verify component interactions within the system.

### Broker Integration Tests

```typescript
// src/__tests__/integration/credentials.integration.test.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';

describe('Credentials Integration', () => {
  let app: INestApplication;
  let validToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    // Get valid test token
    validToken = await getTestToken();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /credentials/mint', () => {
    it('should mint credentials for valid request', () => {
      return request(app.getHttpServer())
        .post('/credentials/mint')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ keys: ['AWS_TEST'] })
        .expect(200)
        .expect((res) => {
          expect(res.body.credentials).toBeDefined();
          expect(res.body.credentials.AWS_TEST).toBeDefined();
          expect(res.body.expiresAt).toBeDefined();
          expect(res.body.subject).toBeDefined();
        });
    });

    it('should reject request with invalid token', () => {
      return request(app.getHttpServer())
        .post('/credentials/mint')
        .set('Authorization', 'Bearer invalid-token')
        .send({ keys: ['AWS_TEST'] })
        .expect(401);
    });

    it('should reject request for non-existent key', () => {
      return request(app.getHttpServer())
        .post('/credentials/mint')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ keys: ['NON_EXISTENT_KEY'] })
        .expect(404);
    });
  });

  describe('GET /credentials/keys', () => {
    it('should list available keys', () => {
      return request(app.getHttpServer())
        .get('/credentials/keys')
        .set('Authorization', `Bearer ${validToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.keys).toBeDefined();
          expect(Array.isArray(res.body.keys)).toBe(true);
        });
    });
  });
});

async function getTestToken(): Promise<string> {
  // Get token from test IdP
  const response = await request('http://localhost:8080')
    .post('/realms/client/protocol/openid-connect/token')
    .send({
      client_id: 'test-client',
      username: 'test-user',
      password: 'test-password',
      grant_type: 'password'
    });

  return response.body.access_token;
}
```

### Database Integration Tests

```typescript
// src/__tests__/integration/database.integration.test.ts
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ConfigModule } from '../../config/config.module';

describe('Configuration Loading', () => {
  let configService: ConfigService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [ConfigModule],
    }).compile();

    configService = module.get<ConfigService>(ConfigService);
  });

  it('should load broker IdP configuration', () => {
    const brokerIdp = configService.get('brokerIdp');
    
    expect(brokerIdp).toBeDefined();
    expect(brokerIdp.name).toBeDefined();
    expect(brokerIdp.issuer).toBeDefined();
    expect(brokerIdp.clientId).toBeDefined();
  });

  it('should load client IdPs configuration', () => {
    const clientIdps = configService.get('clientIdps');
    
    expect(Array.isArray(clientIdps)).toBe(true);
    expect(clientIdps.length).toBeGreaterThan(0);
    
    clientIdps.forEach(idp => {
      expect(idp.name).toBeDefined();
      expect(idp.issuer).toBeDefined();
    });
  });

  it('should validate configuration schema', () => {
    const config = configService.get('');
    
    // Test required fields
    expect(config.brokerIdp).toBeDefined();
    expect(config.clientIdps).toBeDefined();
    expect(config.accessProviders).toBeDefined();
    expect(config.clientIdentities).toBeDefined();
  });
});
```

## End-to-End Testing

E2E tests verify the complete system workflow.

### Complete Workflow Test

```bash
#!/bin/bash
# scripts/e2e-test.sh

set -e

echo "Starting E2E test..."

# Start services
echo "Starting sandbox services..."
cd sandbox
docker-compose up -d
sleep 30

# Start broker server
echo "Starting broker server..."
cd ../broker-server
npm run start:dev &
BROKER_PID=$!
sleep 10

# Build CLI
echo "Building CLI..."
cd ../cli
go build -o voidkey main.go

# Wait for services to be ready
echo "Waiting for services..."
until curl -f http://localhost:8080/health >/dev/null 2>&1; do sleep 1; done
until curl -f http://localhost:3000/health >/dev/null 2>&1; do sleep 1; done

# Get test token
echo "Getting OIDC token..."
TOKEN=$(curl -s -X POST "http://localhost:8080/realms/client/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=test-client" \
  -d "username=test-user" \
  -d "password=test-password" \
  -d "grant_type=password" | jq -r '.access_token')

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
  echo "Failed to get OIDC token"
  exit 1
fi

echo "Token obtained: ${TOKEN:0:20}..."

# Test CLI commands
echo "Testing CLI commands..."

# Test list-keys
echo "Testing list-keys..."
./voidkey list-keys --broker-url http://localhost:3000 --token "$TOKEN"

# Test mint credentials
echo "Testing mint credentials..."
CREDS=$(./voidkey mint --keys MINIO_TEST --broker-url http://localhost:3000 --token "$TOKEN" --output json)

# Parse credentials
ACCESS_KEY=$(echo "$CREDS" | jq -r '.MINIO_TEST.MINIO_ACCESS_KEY')
SECRET_KEY=$(echo "$CREDS" | jq -r '.MINIO_TEST.MINIO_SECRET_KEY')

if [ "$ACCESS_KEY" = "null" ] || [ -z "$ACCESS_KEY" ]; then
  echo "Failed to mint credentials"
  exit 1
fi

echo "Credentials minted successfully"

# Test MinIO access
echo "Testing MinIO access..."
mc alias set testminio http://localhost:9000 "$ACCESS_KEY" "$SECRET_KEY"
mc ls testminio/ || echo "MinIO access test completed"

echo "E2E test completed successfully!"

# Cleanup
echo "Cleaning up..."
kill $BROKER_PID 2>/dev/null || true
cd ../sandbox
docker-compose down

echo "Cleanup completed"
```

### Automated E2E Testing

```yaml
# .github/workflows/e2e.yml
name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  e2e:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Setup Go
        uses: actions/setup-go@v4
        with:
          go-version: '1.21'
      
      - name: Install dependencies
        run: |
          cd broker-core && npm ci
          cd ../broker-server && npm ci
          cd ../cli && go mod download
      
      - name: Build components
        run: |
          cd broker-core && npm run build
          cd ../broker-server && npm run build
          cd ../cli && go build -o voidkey main.go
      
      - name: Start services
        run: |
          cd sandbox
          docker-compose up -d
          sleep 30
      
      - name: Run E2E tests
        run: ./scripts/e2e-test.sh
        timeout-minutes: 10
      
      - name: Cleanup
        if: always()
        run: |
          cd sandbox
          docker-compose down -v
```

## Mock Testing

### Mocking External Services

```typescript
// src/__tests__/mocks/idp.mock.ts
export class MockIdpProvider implements IdpProvider {
  name = 'mock-idp';
  issuer = 'https://mock-idp.example.com';
  audience = 'test-audience';

  async validateToken(token: string): Promise<TokenClaims> {
    // Parse mock token format
    const [header, payload] = token.split('.');
    const claims = JSON.parse(atob(payload));

    return {
      issuer: this.issuer,
      subject: claims.sub,
      audience: [this.audience],
      expiresAt: new Date(claims.exp * 1000),
      issuedAt: new Date(claims.iat * 1000),
      customClaims: {}
    };
  }

  async getPublicKeys(): Promise<JWKSet> {
    return {
      keys: [{
        kid: 'mock-key',
        kty: 'RSA',
        use: 'sig',
        n: 'mock-n',
        e: 'AQAB'
      }]
    };
  }
}

// src/__tests__/mocks/access.mock.ts
export class MockAccessProvider implements AccessProvider {
  name = 'mock-access';
  type = 'mock';

  async authenticate(brokerToken: string): Promise<void> {
    // Mock authentication - always succeeds
  }

  async mintCredentials(keyConfig: any, subject: string): Promise<Credentials> {
    return {
      AccessKeyId: 'ASIAMOCKACCESSKEY',
      SecretAccessKey: 'mockSecretAccessKey',
      SessionToken: 'mockSessionToken',
      Expiration: new Date(Date.now() + keyConfig.duration * 1000)
    };
  }
}
```

### Using Mocks in Tests

```typescript
// src/__tests__/services/credentials.service.test.ts
import { Test } from '@nestjs/testing';
import { CredentialsService } from '../../services/credentials.service';
import { MockIdpProvider, MockAccessProvider } from '../mocks';

describe('CredentialsService', () => {
  let service: CredentialsService;
  let mockIdpProvider: MockIdpProvider;
  let mockAccessProvider: MockAccessProvider;

  beforeEach(async () => {
    mockIdpProvider = new MockIdpProvider();
    mockAccessProvider = new MockAccessProvider();

    const module = await Test.createTestingModule({
      providers: [
        CredentialsService,
        { provide: 'IDP_PROVIDER', useValue: mockIdpProvider },
        { provide: 'ACCESS_PROVIDER', useValue: mockAccessProvider }
      ]
    }).compile();

    service = module.get<CredentialsService>(CredentialsService);
  });

  it('should mint credentials successfully', async () => {
    const mockToken = btoa(JSON.stringify({ 
      sub: 'test-subject',
      exp: Math.floor(Date.now() / 1000) + 3600 
    }));

    const result = await service.mintCredentials(`header.${mockToken}.signature`, ['TEST_KEY']);

    expect(result.credentials.TEST_KEY).toBeDefined();
    expect(result.subject).toBe('test-subject');
  });
});
```

## Performance Testing

### Load Testing

```javascript
// scripts/load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 }, // Ramp up
    { duration: '5m', target: 100 }, // Stay at 100 users
    { duration: '2m', target: 200 }, // Ramp up to 200 users
    { duration: '5m', target: 200 }, // Stay at 200 users
    { duration: '2m', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests under 1s
    http_req_failed: ['rate<0.1'],     // Error rate under 10%
  }
};

const BROKER_URL = 'http://localhost:3000';
const TEST_TOKEN = 'eyJhbGciOiJSUzI1NiIs...'; // Valid test token

export default function() {
  // Test mint credentials endpoint
  const mintResponse = http.post(`${BROKER_URL}/credentials/mint`, 
    JSON.stringify({ keys: ['AWS_TEST'] }),
    {
      headers: {
        'Authorization': `Bearer ${TEST_TOKEN}`,
        'Content-Type': 'application/json'
      }
    }
  );

  check(mintResponse, {
    'mint status is 200': (r) => r.status === 200,
    'mint response has credentials': (r) => JSON.parse(r.body).credentials !== undefined,
  });

  // Test list keys endpoint
  const keysResponse = http.get(`${BROKER_URL}/credentials/keys`, {
    headers: { 'Authorization': `Bearer ${TEST_TOKEN}` }
  });

  check(keysResponse, {
    'keys status is 200': (r) => r.status === 200,
    'keys response has keys array': (r) => Array.isArray(JSON.parse(r.body).keys),
  });

  sleep(1);
}
```

Run load tests:
```bash
# Install k6
brew install k6  # macOS
# or
sudo apt install k6  # Ubuntu

# Run load test
k6 run scripts/load-test.js
```

### Memory and CPU Profiling

```bash
# Node.js profiling
node --inspect --inspect-brk broker-server/dist/main.js

# Go profiling
go test -cpuprofile cpu.prof -memprofile mem.prof -bench . ./...
go tool pprof cpu.prof
```

## Test Configuration

### Jest Configuration

```javascript
// jest.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/*.spec.ts'
  ],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/**/*.interface.ts'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 10000
};
```

### Test Setup

```typescript
// src/__tests__/setup.ts
import { config } from 'dotenv';

// Load test environment variables
config({ path: '.env.test' });

// Global test configuration
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

// Mock external services
jest.mock('node-fetch');
jest.mock('jwks-rsa');

// Global test utilities
global.createMockToken = (claims: any) => {
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: 'https://test.example.com',
    aud: 'test-audience',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    ...claims
  };

  return `${btoa(JSON.stringify(header))}.${btoa(JSON.stringify(payload))}.mock-signature`;
};
```

## Continuous Integration

### GitHub Actions Testing

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [18, 20]
        go-version: [1.21]
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: 'npm'
      
      - name: Setup Go ${{ matrix.go-version }}
        uses: actions/setup-go@v4
        with:
          go-version: ${{ matrix.go-version }}
      
      - name: Install TypeScript dependencies
        run: |
          cd broker-core && npm ci
          cd ../broker-server && npm ci
      
      - name: Run TypeScript tests
        run: |
          cd broker-core && npm run test:coverage
          cd ../broker-server && npm run test:cov
      
      - name: Run Go tests
        run: |
          cd cli
          go test -v -cover ./...
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./broker-core/coverage/lcov.info,./broker-server/coverage/lcov.info

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    
    services:
      keycloak:
        image: quay.io/keycloak/keycloak:latest
        env:
          KEYCLOAK_ADMIN: admin
          KEYCLOAK_ADMIN_PASSWORD: admin
        ports:
          - 8080:8080
        options: --health-cmd="curl -f http://localhost:8080/health" --health-interval=30s --health-timeout=10s --health-retries=5
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: |
          cd broker-core && npm ci
          cd ../broker-server && npm ci
      
      - name: Run integration tests
        run: |
          cd broker-server
          npm run test:integration
        env:
          KEYCLOAK_URL: http://localhost:8080
```

## Best Practices

### Test Organization

```
src/
├── __tests__/
│   ├── unit/
│   │   ├── providers/
│   │   ├── services/
│   │   └── utils/
│   ├── integration/
│   │   ├── api/
│   │   └── providers/
│   ├── e2e/
│   │   └── workflows/
│   ├── mocks/
│   │   ├── providers/
│   │   └── services/
│   └── fixtures/
│       ├── tokens/
│       └── configs/
└── components/
```

### Test Naming

```typescript
// Good test names
describe('GitHubActionsProvider', () => {
  describe('validateToken', () => {
    it('should validate token with valid subject format', () => {});
    it('should reject token with invalid audience', () => {});
    it('should throw error when token is expired', () => {});
  });
});

// Bad test names
describe('GitHubActionsProvider', () => {
  it('test1', () => {});
  it('should work', () => {});
  it('validates', () => {});
});
```

### Test Data Management

```typescript
// src/__tests__/fixtures/tokens.ts
export const validGitHubToken = {
  header: { alg: 'RS256', typ: 'JWT', kid: 'github-key' },
  payload: {
    iss: 'https://token.actions.githubusercontent.com',
    aud: 'https://github.com/myorg',
    sub: 'repo:myorg/myapp:ref:refs/heads/main',
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    repository: 'myorg/myapp',
    ref: 'refs/heads/main'
  }
};

export const expiredToken = {
  ...validGitHubToken,
  payload: {
    ...validGitHubToken.payload,
    exp: Math.floor(Date.now() / 1000) - 3600 // 1 hour ago
  }
};
```

## Next Steps

- [Development Setup](/development/setup/) - Set up development environment
- [Contributing Guide](/development/contributing/) - Contribution guidelines
- [API Reference](/api/rest/) - API testing strategies
- [Security Model](/architecture/security/) - Security testing considerations