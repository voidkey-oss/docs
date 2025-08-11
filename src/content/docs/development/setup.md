---
title: Development Setup
description: Set up your local development environment for Voidkey
---

This guide walks you through setting up a complete Voidkey development environment.

## Prerequisites

### Required Software

- **Node.js** 18+ and npm 9+
- **Go** 1.21+ 
- **Docker** and Docker Compose
- **Git**
- **Make** (optional but recommended)

### Recommended Tools

- **VS Code** or similar IDE with TypeScript support
- **Postman** or similar for API testing
- **jq** for JSON manipulation
- **direnv** for environment management

## Repository Setup

### 1. Clone the Repository

```bash
git clone https://github.com/voidkey-oss/voidkey.git
cd voidkey
```

### 2. Repository Structure

```
voidkey/
├── broker-core/        # TypeScript core library
├── broker-server/      # NestJS HTTP server
├── cli/               # Go CLI client
├── sandbox/           # Docker development environment
├── docs/              # Documentation (Astro)
├── scripts/           # Development scripts
└── CLAUDE.md          # AI assistant instructions
```

## Development Environment

### 1. Start the Sandbox

The sandbox provides a complete local environment:

```bash
cd sandbox
docker-compose up -d

# Wait for services to be ready
docker-compose ps

# View logs
docker-compose logs -f
```

This starts:
- **Keycloak** on `http://localhost:8080`
  - Admin: `admin` / `admin`
  - Test realm with pre-configured clients
- **MinIO** on `http://localhost:9000`
  - Console: `http://localhost:9001`
  - Root: `minioadmin` / `minioadmin`

### 2. Environment Variables

Create a `.env` file in the root:

```bash
# Development environment
NODE_ENV=development
LOG_LEVEL=debug

# Broker configuration
BROKER_CLIENT_SECRET=dev-secret-12345
CONFIG_PATH=./sandbox/config/dev-config.yaml

# URLs
VOIDKEY_BROKER_URL=http://localhost:3000
KEYCLOAK_URL=http://localhost:8080
MINIO_URL=http://localhost:9000
```

## Component Development

### broker-core Development

```bash
cd broker-core

# Install dependencies
npm install

# Run in watch mode
npm run dev

# Run tests in watch mode
npm run test:watch

# Build
npm run build

# Type checking
npm run type-check
```

#### Core Development Tasks

**Adding a new IdP Provider:**

1. Create provider file:
```typescript
// src/providers/idp/my-idp.provider.ts
import { IdpProvider, TokenClaims } from '../interfaces';

export class MyIdpProvider implements IdpProvider {
  constructor(private config: MyIdpConfig) {}

  async validateToken(token: string): Promise<TokenClaims> {
    // Implementation
  }

  async getPublicKeys(): Promise<JWKSet> {
    // Implementation
  }
}
```

2. Add tests:
```typescript
// src/providers/idp/__tests__/my-idp.provider.test.ts
describe('MyIdpProvider', () => {
  it('should validate tokens', async () => {
    // Test implementation
  });
});
```

3. Register provider:
```typescript
// src/providers/idp/index.ts
export { MyIdpProvider } from './my-idp.provider';
```

### broker-server Development

```bash
cd broker-server

# Install dependencies
npm install

# Run development server
npm run dev

# The server will reload automatically on changes
# API available at http://localhost:3000
```

#### Server Development Tasks

**Adding a new endpoint:**

1. Create DTO:
```typescript
// src/credentials/dto/my-endpoint.dto.ts
import { IsString, IsArray } from 'class-validator';

export class MyEndpointDto {
  @IsString()
  someField: string;

  @IsArray()
  @IsString({ each: true })
  items: string[];
}
```

2. Update controller:
```typescript
// src/credentials/credentials.controller.ts
@Post('my-endpoint')
async myEndpoint(@Body() dto: MyEndpointDto) {
  return this.credentialsService.processMyEndpoint(dto);
}
```

3. Add service method:
```typescript
// src/credentials/credentials.service.ts
async processMyEndpoint(dto: MyEndpointDto) {
  // Implementation
}
```

### CLI Development

```bash
cd cli

# Get dependencies
go mod download

# Run during development
go run main.go mint --keys TEST_KEY

# Run tests
go test ./...

# Build binary
go build -o voidkey main.go

# Run built binary
./voidkey --help
```

#### CLI Development Tasks

**Adding a new command:**

1. Create command file:
```go
// cmd/mycommand.go
package cmd

import (
    "github.com/spf13/cobra"
)

func newMyCommand() *cobra.Command {
    cmd := &cobra.Command{
        Use:   "mycommand",
        Short: "Description of my command",
        RunE: func(cmd *cobra.Command, args []string) error {
            // Implementation
            return nil
        },
    }
    
    cmd.Flags().StringP("option", "o", "", "Option description")
    
    return cmd
}
```

2. Register command:
```go
// cmd/root.go
func init() {
    rootCmd.AddCommand(newMyCommand())
}
```

## Testing

### Unit Tests

Each component has its own test suite:

```bash
# broker-core
cd broker-core
npm test
npm run test:coverage

# broker-server
cd broker-server
npm test
npm run test:cov

# CLI
cd cli
go test ./... -v
go test -cover ./...
```

### Integration Tests

Run integration tests against the sandbox:

```bash
# Start sandbox first
cd sandbox
docker-compose up -d

# Run integration tests
cd ../broker-server
npm run test:integration

# Or specific test file
npm test -- --testPathPattern=integration
```

### E2E Tests

Full end-to-end test script:

```bash
#!/bin/bash
# scripts/e2e-test.sh

# Start all services
cd sandbox && docker-compose up -d
cd ../broker-server && npm run dev &
SERVER_PID=$!

# Wait for services
sleep 10

# Get test token
TOKEN=$(curl -s -X POST \
  "http://localhost:8080/realms/client/protocol/openid-connect/token" \
  -d "client_id=test-client" \
  -d "username=test-user" \
  -d "password=test-password" \
  -d "grant_type=password" | jq -r '.access_token')

# Test CLI
cd ../cli
go run main.go mint --token "$TOKEN" --keys MINIO_TEST

# Cleanup
kill $SERVER_PID
cd ../sandbox && docker-compose down
```

## Development Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/my-feature

# Make changes and test
npm test

# Commit with conventional commits
git commit -m "feat: add support for X"

# Push and create PR
git push -u origin feature/my-feature
```

### 2. Debugging

**VS Code Launch Configuration:**

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug Broker Server",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "start:debug"],
      "cwd": "${workspaceFolder}/broker-server",
      "console": "integratedTerminal"
    },
    {
      "type": "go",
      "request": "launch",
      "name": "Debug CLI",
      "program": "${workspaceFolder}/cli/main.go",
      "args": ["mint", "--keys", "TEST_KEY"],
      "env": {
        "VOIDKEY_BROKER_URL": "http://localhost:3000",
        "VOIDKEY_OIDC_TOKEN": "test-token"
      }
    }
  ]
}
```

**Debug Logging:**

```typescript
// Enable debug logs
import { Logger } from '@nestjs/common';

const logger = new Logger('MyClass');
logger.debug('Debug message', { data });
```

### 3. Code Quality

**Linting:**
```bash
# TypeScript
cd broker-core
npm run lint
npm run lint:fix

# Go
cd cli
golangci-lint run
```

**Formatting:**
```bash
# TypeScript (Prettier)
npm run format

# Go
go fmt ./...
```

## Common Development Tasks

### Adding Configuration Options

1. Update configuration interface:
```typescript
// broker-core/src/config/interfaces.ts
export interface BrokerConfig {
  newOption?: string;
}
```

2. Add validation:
```typescript
// broker-core/src/config/validator.ts
if (config.newOption && !isValidOption(config.newOption)) {
  throw new Error('Invalid newOption');
}
```

3. Update example config:
```yaml
# sandbox/config/example-config.yaml
newOption: "example-value"
```

### Testing with Different IdPs

**Auth0 Setup:**
```bash
# Use Auth0 instead of Keycloak
export BROKER_IDP_ISSUER="https://dev-xxx.auth0.com/"
export BROKER_IDP_CLIENT_ID="your-client-id"
export BROKER_IDP_CLIENT_SECRET="your-client-secret"
```

**GitHub Actions Local:**
```bash
# Use act to run GitHub Actions locally
act -s GITHUB_TOKEN=your-token
```

### Performance Profiling

```bash
# Node.js profiling
node --inspect broker-server/dist/main.js

# Go profiling
go test -cpuprofile cpu.prof -memprofile mem.prof ./...
go tool pprof cpu.prof
```

## Troubleshooting

### Common Issues

**Port conflicts:**
```bash
# Check what's using ports
lsof -i :3000  # Broker server
lsof -i :8080  # Keycloak
lsof -i :9000  # MinIO

# Change ports in docker-compose.yml if needed
```

**Module resolution errors:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Link local packages
cd broker-core && npm link
cd ../broker-server && npm link @voidkey/broker-core
```

**Docker issues:**
```bash
# Reset Docker environment
docker-compose down -v
docker system prune -f
docker-compose up --build
```

### Debug Commands

```bash
# Check service health
curl http://localhost:3000/health

# Test Keycloak connection
curl http://localhost:8080/realms/broker/.well-known/openid-configuration

# Test MinIO
curl http://localhost:9000/minio/health/live

# View all logs
docker-compose logs -f --tail=100
```

## Next Steps

- [Testing Guide](/development/testing/) - Writing and running tests
- [Contributing Guide](/development/contributing/) - Contribution guidelines
- [API Development](/api/rest/) - API development guide
- [Deployment Guide](/deployment/docker/) - Deploy your changes