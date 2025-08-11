---
title: Local Development Examples
description: Examples of using Voidkey for local development workflows
---

This guide provides practical examples of using Voidkey in local development environments for secure credential management.

## Quick Start with Sandbox

The fastest way to get started with Voidkey locally is using the provided sandbox environment.

### Setting Up the Sandbox

```bash
# Clone the repository
git clone https://github.com/voidkey-oss/voidkey.git
cd voidkey

# Start the sandbox environment
cd sandbox
docker-compose up -d

# Wait for services to start (about 30 seconds)
docker-compose logs -f
```

This starts:
- **Keycloak** (localhost:8080) - Identity provider
- **MinIO** (localhost:9000) - Object storage
- **PostgreSQL** - Database for Keycloak

### Building and Running the Broker

```bash
# Build broker-core
cd broker-core
npm install
npm run build

# Build and start broker-server
cd ../broker-server
npm install
npm run build
npm run start:dev
```

The broker server will be available at `http://localhost:3000`.

### Building the CLI

```bash
# Build the CLI
cd cli
go build -o voidkey main.go

# Test the CLI
./voidkey --help
```

## Development Workflows

### Basic Credential Minting

```bash
# Get a test token from Keycloak
TOKEN=$(curl -s -X POST "http://localhost:8080/realms/client/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=test-client" \
  -d "username=test-user" \
  -d "password=test-password" \
  -d "grant_type=password" | jq -r '.access_token')

# List available keys
./voidkey list-keys --broker-url http://localhost:3000 --token "$TOKEN"

# Mint MinIO credentials
./voidkey mint --keys MINIO_TEST --broker-url http://localhost:3000 --token "$TOKEN"
```

### Environment-Specific Development

Create different configurations for development stages:

```bash
# Development environment
export VOIDKEY_BROKER_URL="http://localhost:3000"
export VOIDKEY_TOKEN="$(get_dev_token)"

# Staging environment
export VOIDKEY_BROKER_URL="https://voidkey-staging.company.com"
export VOIDKEY_TOKEN="$(get_staging_token)"

# Production environment (read-only access)
export VOIDKEY_BROKER_URL="https://voidkey.company.com"
export VOIDKEY_TOKEN="$(get_prod_token)"
```

### Development Script

```bash
#!/bin/bash
# scripts/dev-setup.sh

set -e

ENVIRONMENT=${1:-development}
BROKER_URL="http://localhost:3000"

echo "Setting up development environment: $ENVIRONMENT"

# Function to get development token
get_dev_token() {
    curl -s -X POST "http://localhost:8080/realms/client/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "client_id=test-client" \
        -d "username=test-user" \
        -d "password=test-password" \
        -d "grant_type=password" | jq -r '.access_token'
}

# Get token
echo "Getting development token..."
TOKEN=$(get_dev_token)

if [ "$TOKEN" = "null" ] || [ -z "$TOKEN" ]; then
    echo "Failed to get token. Is the sandbox running?"
    exit 1
fi

# Get credentials based on environment
case "$ENVIRONMENT" in
    "development")
        KEYS="MINIO_TEST,AWS_DEV"
        ;;
    "testing")
        KEYS="MINIO_TEST,AWS_TEST"
        ;;
    "staging") 
        KEYS="AWS_STAGING"
        ;;
    *)
        echo "Unknown environment: $ENVIRONMENT"
        exit 1
        ;;
esac

echo "Minting credentials for keys: $KEYS"

# Mint credentials
./voidkey mint \
    --keys "$KEYS" \
    --broker-url "$BROKER_URL" \
    --token "$TOKEN" \
    --output dotenv > .env.local

echo "Credentials saved to .env.local"
echo "Run 'source .env.local' to load credentials"
```

## IDE Integration

### VS Code Integration

Create a VS Code task to get credentials:

```json
// .vscode/tasks.json
{
    "version": "2.0.0",
    "tasks": [
        {
            "label": "Get Voidkey Credentials",
            "type": "shell",
            "command": "./scripts/dev-setup.sh",
            "args": ["${input:environment}"],
            "group": "build",
            "presentation": {
                "echo": true,
                "reveal": "always",
                "focus": false,
                "panel": "shared"
            },
            "problemMatcher": []
        }
    ],
    "inputs": [
        {
            "id": "environment",
            "description": "Select environment",
            "default": "development",
            "type": "pickString",
            "options": [
                "development",
                "testing",
                "staging"
            ]
        }
    ]
}
```

Create a launch configuration that uses credentials:

```json
// .vscode/launch.json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "Run App with Voidkey",
            "type": "node",
            "request": "launch",
            "program": "${workspaceFolder}/src/index.js",
            "envFile": "${workspaceFolder}/.env.local",
            "preLaunchTask": "Get Voidkey Credentials"
        }
    ]
}
```

### JetBrains IDEs Integration

Create a run configuration that gets credentials:

```xml
<!-- .idea/runConfigurations/VoidkeyApp.xml -->
<component name="ProjectRunConfigurationManager">
  <configuration default="false" name="VoidkeyApp" type="NodeJSConfigurationType" path-to-js-file="src/index.js">
    <envs>
      <env name="NODE_ENV" value="development" />
    </envs>
    <before-run>
      <method type="RunConfigurationTask" runConfigName="Get Credentials" />
    </before-run>
  </configuration>
</component>
```

## Docker Development

### Development Dockerfile

```dockerfile
# Dockerfile.dev
FROM node:18-alpine

WORKDIR /app

# Install Voidkey CLI
RUN wget -O voidkey https://github.com/voidkey-oss/voidkey/releases/latest/download/voidkey-linux-amd64 \
    && chmod +x voidkey \
    && mv voidkey /usr/local/bin/

# Copy package files
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Create entrypoint script
RUN cat > entrypoint.sh << 'EOF'
#!/bin/sh
set -e

echo "Getting development credentials..."

# Get credentials from Voidkey
voidkey mint \
    --keys ${VOIDKEY_KEYS:-MINIO_TEST} \
    --broker-url ${VOIDKEY_BROKER_URL:-http://broker:3000} \
    --token ${VOIDKEY_TOKEN} \
    --output dotenv > .env.runtime

# Load credentials and start app
set -a
source .env.runtime
set +a

exec "$@"
EOF

RUN chmod +x entrypoint.sh

ENTRYPOINT ["./entrypoint.sh"]
CMD ["npm", "run", "dev"]
```

### Docker Compose for Development

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "3001:3000"
    environment:
      - VOIDKEY_BROKER_URL=http://broker:3000
      - VOIDKEY_KEYS=MINIO_TEST,AWS_DEV
      - VOIDKEY_TOKEN=${VOIDKEY_TOKEN}
    depends_on:
      - broker
      - keycloak
    volumes:
      - .:/app
      - /app/node_modules
    command: npm run dev

  broker:
    build:
      context: ./broker-server
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - CONFIG_PATH=/app/config/dev-config.yaml
    depends_on:
      - keycloak
    volumes:
      - ./broker-server/config:/app/config
      - ./broker-server/src:/app/src

  keycloak:
    image: quay.io/keycloak/keycloak:latest
    ports:
      - "8080:8080"
    environment:
      - KEYCLOAK_ADMIN=admin
      - KEYCLOAK_ADMIN_PASSWORD=admin
    command: start-dev
    volumes:
      - ./sandbox/keycloak:/opt/keycloak/data/import

  minio:
    image: minio/minio:latest
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      - MINIO_ROOT_USER=minioadmin
      - MINIO_ROOT_PASSWORD=minioadmin
    command: server /data --console-address ":9001"
    volumes:
      - minio_data:/data

volumes:
  minio_data:
```

### Running Development Environment

```bash
# Get development token
export VOIDKEY_TOKEN=$(curl -s -X POST "http://localhost:8080/realms/client/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=test-client" \
  -d "username=test-user" \
  -d "password=test-password" \
  -d "grant_type=password" | jq -r '.access_token')

# Start development environment
docker-compose -f docker-compose.dev.yml up
```

## Testing Workflows

### Unit Testing with Mocked Credentials

```javascript
// tests/setup.js
const { mockCredentials } = require('./helpers/voidkey-mock');

beforeEach(() => {
    // Mock Voidkey credentials
    process.env = {
        ...process.env,
        ...mockCredentials({
            AWS_ACCESS_KEY_ID: 'ASIATESTKEY',
            AWS_SECRET_ACCESS_KEY: 'testsecret',
            AWS_SESSION_TOKEN: 'testtoken',
            MINIO_ACCESS_KEY: 'testminio',
            MINIO_SECRET_KEY: 'testminiosecret'
        })
    };
});
```

### Integration Testing

```javascript
// tests/integration/voidkey.test.js
const { execSync } = require('child_process');

describe('Voidkey Integration', () => {
    let token;
    
    beforeAll(async () => {
        // Get test token
        const response = await fetch('http://localhost:8080/realms/client/protocol/openid-connect/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: 'test-client',
                username: 'test-user',
                password: 'test-password',
                grant_type: 'password'
            })
        });
        const data = await response.json();
        token = data.access_token;
    });
    
    test('should mint MinIO credentials', () => {
        const result = execSync(`./voidkey mint --keys MINIO_TEST --broker-url http://localhost:3000 --token "${token}" --output json`);
        const credentials = JSON.parse(result.toString());
        
        expect(credentials.MINIO_TEST).toBeDefined();
        expect(credentials.MINIO_TEST.MINIO_ACCESS_KEY).toBeDefined();
        expect(credentials.MINIO_TEST.MINIO_SECRET_KEY).toBeDefined();
    });
    
    test('should list available keys', () => {
        const result = execSync(`./voidkey list-keys --broker-url http://localhost:3000 --token "${token}" --output json`);
        const keys = JSON.parse(result.toString());
        
        expect(Array.isArray(keys.keys)).toBe(true);
        expect(keys.keys.length).toBeGreaterThan(0);
    });
});
```

## Development Utilities

### Credential Helper Script

```bash
#!/bin/bash
# scripts/creds.sh

# Voidkey credential helper for development

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

BROKER_URL="${VOIDKEY_BROKER_URL:-http://localhost:3000}"
TOKEN_FILE="$PROJECT_ROOT/.voidkey-token"
CREDS_FILE="$PROJECT_ROOT/.env.local"

# Function to get fresh token
get_token() {
    echo "Getting fresh token from Keycloak..."
    curl -s -X POST "http://localhost:8080/realms/client/protocol/openid-connect/token" \
        -H "Content-Type: application/x-www-form-urlencoded" \
        -d "client_id=test-client" \
        -d "username=test-user" \
        -d "password=test-password" \
        -d "grant_type=password" | jq -r '.access_token' > "$TOKEN_FILE"
}

# Function to check if token is valid
check_token() {
    if [ ! -f "$TOKEN_FILE" ]; then
        return 1
    fi
    
    TOKEN=$(cat "$TOKEN_FILE")
    if [ -z "$TOKEN" ] || [ "$TOKEN" = "null" ]; then
        return 1
    fi
    
    # Check if token is expired (simple check)
    EXPIRY=$(echo "$TOKEN" | base64 -d 2>/dev/null | jq -r '.exp // empty' 2>/dev/null || echo "")
    if [ -n "$EXPIRY" ] && [ "$EXPIRY" -lt "$(date +%s)" ]; then
        return 1
    fi
    
    return 0
}

# Command functions
cmd_login() {
    get_token
    echo "Token saved to $TOKEN_FILE"
}

cmd_mint() {
    local keys=${1:-MINIO_TEST}
    
    if ! check_token; then
        echo "Token expired or missing, getting fresh token..."
        get_token
    fi
    
    TOKEN=$(cat "$TOKEN_FILE")
    
    echo "Minting credentials for keys: $keys"
    ./voidkey mint \
        --keys "$keys" \
        --broker-url "$BROKER_URL" \
        --token "$TOKEN" \
        --output dotenv > "$CREDS_FILE"
    
    echo "Credentials saved to $CREDS_FILE"
    echo "Run 'source $CREDS_FILE' to load credentials"
}

cmd_env() {
    if [ ! -f "$CREDS_FILE" ]; then
        echo "No credentials file found. Run 'creds mint' first."
        exit 1
    fi
    
    source "$CREDS_FILE"
    echo "Credentials loaded into environment"
}

cmd_clean() {
    rm -f "$TOKEN_FILE" "$CREDS_FILE"
    echo "Cleaned up token and credentials files"
}

cmd_status() {
    echo "Broker URL: $BROKER_URL"
    
    if check_token; then
        echo "Token: Valid"
    else
        echo "Token: Invalid or missing"
    fi
    
    if [ -f "$CREDS_FILE" ]; then
        echo "Credentials: Available"
        echo "  File: $CREDS_FILE"
        echo "  Size: $(wc -l < "$CREDS_FILE") lines"
    else
        echo "Credentials: Not available"
    fi
}

# Main command handler
case "${1:-status}" in
    "login")
        cmd_login
        ;;
    "mint")
        cmd_mint "$2"
        ;;
    "env")
        cmd_env
        ;;
    "clean")
        cmd_clean
        ;;
    "status")
        cmd_status
        ;;
    *)
        echo "Usage: $0 {login|mint [keys]|env|clean|status}"
        echo
        echo "Commands:"
        echo "  login          Get fresh token from Keycloak"
        echo "  mint [keys]    Mint credentials (default: MINIO_TEST)"
        echo "  env            Load credentials into environment"
        echo "  clean          Clean up token and credential files"
        echo "  status         Show current status"
        exit 1
        ;;
esac
```

### Development Makefile

```makefile
# Makefile
.PHONY: dev-setup dev-start dev-stop dev-clean test-local

# Development environment
dev-setup:
	@echo "Setting up development environment..."
	cd sandbox && docker-compose up -d
	@echo "Waiting for services to start..."
	@sleep 30
	cd broker-core && npm install && npm run build
	cd broker-server && npm install && npm run build
	cd cli && go build -o voidkey main.go

dev-start:
	@echo "Starting broker server..."
	cd broker-server && npm run start:dev &
	@echo "Broker server started on http://localhost:3000"

dev-stop:
	@echo "Stopping development environment..."
	cd sandbox && docker-compose down
	@pkill -f "npm run start:dev" || true

dev-clean:
	@echo "Cleaning development environment..."
	cd sandbox && docker-compose down -v
	rm -f .voidkey-token .env.local
	cd broker-core && rm -rf node_modules dist
	cd broker-server && rm -rf node_modules dist
	cd cli && rm -f voidkey

# Testing
test-local:
	@echo "Running local integration tests..."
	./scripts/creds.sh login
	./scripts/creds.sh mint MINIO_TEST
	source .env.local && ./scripts/test-minio.sh

# Credentials management
creds-login:
	./scripts/creds.sh login

creds-mint:
	./scripts/creds.sh mint $(KEYS)

creds-status:
	./scripts/creds.sh status

# Quick start
start: dev-setup dev-start creds-login
	@echo "Development environment ready!"
	@echo "Run 'make creds-mint' to get credentials"

stop: dev-stop

clean: dev-clean
```

## Debugging and Troubleshooting

### Debug Script

```bash
#!/bin/bash
# scripts/debug.sh

echo "=== Voidkey Development Debug ==="
echo

# Check services
echo "1. Checking services..."
echo -n "  Keycloak: "
curl -s -f http://localhost:8080/health >/dev/null && echo "✓ Running" || echo "✗ Not running"

echo -n "  MinIO: "
curl -s -f http://localhost:9000/minio/health/live >/dev/null && echo "✓ Running" || echo "✗ Not running"

echo -n "  Broker: "
curl -s -f http://localhost:3000/health >/dev/null && echo "✓ Running" || echo "✗ Not running"

echo

# Check CLI
echo "2. Checking CLI..."
if [ -f "./voidkey" ]; then
    echo "  CLI: ✓ Built"
    ./voidkey --version 2>/dev/null || echo "  Version: Unknown"
else
    echo "  CLI: ✗ Not built"
fi

echo

# Check token
echo "3. Checking token..."
if [ -f ".voidkey-token" ]; then
    TOKEN=$(cat .voidkey-token)
    if [ -n "$TOKEN" ] && [ "$TOKEN" != "null" ]; then
        echo "  Token: ✓ Available"
        # Decode token payload (basic check)
        PAYLOAD=$(echo "$TOKEN" | cut -d. -f2 | base64 -d 2>/dev/null | jq . 2>/dev/null || echo "Invalid")
        if [ "$PAYLOAD" != "Invalid" ]; then
            echo "  Subject: $(echo "$PAYLOAD" | jq -r '.sub // "Unknown"')"
            echo "  Expires: $(echo "$PAYLOAD" | jq -r '.exp // "Unknown"' | xargs -I {} date -d @{} 2>/dev/null || echo "Unknown")"
        fi
    else
        echo "  Token: ✗ Invalid"
    fi
else
    echo "  Token: ✗ Not found"
fi

echo

# Test basic functionality
echo "4. Testing basic functionality..."
if [ -f "./voidkey" ] && [ -f ".voidkey-token" ]; then
    TOKEN=$(cat .voidkey-token)
    echo -n "  List keys: "
    if ./voidkey list-keys --broker-url http://localhost:3000 --token "$TOKEN" >/dev/null 2>&1; then
        echo "✓ Working"
    else
        echo "✗ Failed"
    fi
    
    echo -n "  Mint test credentials: "
    if ./voidkey mint --keys MINIO_TEST --broker-url http://localhost:3000 --token "$TOKEN" >/dev/null 2>&1; then
        echo "✓ Working"
    else
        echo "✗ Failed"
    fi
else
    echo "  Skipped (missing CLI or token)"
fi

echo
echo "=== Debug complete ==="
```

### Log Monitoring

```bash
#!/bin/bash
# scripts/logs.sh

echo "Tailing Voidkey development logs..."

# Function to tail logs with colors
tail_logs() {
    case "$1" in
        "broker")
            cd broker-server && npm run start:dev 2>&1 | sed 's/^/[BROKER] /'
            ;;
        "keycloak")
            cd sandbox && docker-compose logs -f keycloak 2>&1 | sed 's/^/[KEYCLOAK] /'
            ;;
        "minio")
            cd sandbox && docker-compose logs -f minio 2>&1 | sed 's/^/[MINIO] /'
            ;;
        "all")
            cd sandbox && docker-compose logs -f 2>&1 | sed 's/^/[SANDBOX] /' &
            cd broker-server && npm run start:dev 2>&1 | sed 's/^/[BROKER] /' &
            wait
            ;;
        *)
            echo "Usage: $0 {broker|keycloak|minio|all}"
            exit 1
            ;;
    esac
}

tail_logs "${1:-all}"
```

## Next Steps

- [CI/CD Examples](/examples/cicd/) - Production CI/CD integration
- [Configuration Guide](/configuration/guide/) - Configure identity mappings
- [Testing Guide](/development/testing/) - Development testing strategies
- [Contributing](/development/contributing/) - Contributing to Voidkey