---
title: Quick Start
description: Get up and running with Voidkey in minutes
---

Get Voidkey running locally in just a few minutes using our Docker sandbox environment.

## Prerequisites

- Docker and Docker Compose installed
- Git for cloning the repository
- Basic understanding of OIDC and cloud credentials

## 1. Clone the Repository

```bash
git clone https://github.com/voidkey-oss/voidkey.git
cd voidkey
```

## 2. Start the Sandbox Environment

The sandbox provides a complete development environment with pre-configured Keycloak (identity provider) and MinIO (S3-compatible storage).

```bash
cd sandbox
docker compose up -d
```

This starts:
- **Keycloak**: Identity provider on `http://localhost:8080`
- **MinIO**: S3-compatible storage on `http://localhost:9000` (console: `http://localhost:9001`)

Wait for all services to be healthy:

```bash
docker compose ps
```

## 3. Build and Start the Broker Server

```bash
# Build the core library
cd ../broker-core
npm install
npm run build
npm link

# Start the broker server
cd ../broker-server
npm install
npm link @voidkey/broker-core
npm run dev
```

The broker server will start on `http://localhost:3000`.

use `npm link` to connect local packaging of the broker-core for use by the broker-server.

## 4. Build the CLI

```bash
cd ../cli
go build -o voidkey main.go
```

## 5. Authenticate and Mint Credentials

First, obtain an OIDC token from the test Keycloak instance:

```bash
# Get token from Keycloak (using test credentials)
TOKEN=$(curl -s -X POST \
  "http://localhost:8080/realms/client/protocol/openid-connect/token" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=test-client" \
  -d "username=test-user" \
  -d "password=test-password" \
  -d "grant_type=password" | jq -r '.access_token')
```

Now use the CLI to mint MinIO credentials:

```bash
# Set the OIDC token
export VOIDKEY_OIDC_TOKEN=$TOKEN

# Mint MinIO credentials
./voidkey mint --keys MINIO_TEST_CREDENTIALS

# Or export them as environment variables
export $(./voidkey mint --keys MINIO_TEST_CREDENTIALS --output env)
```

## 6. Test the Credentials

Use the minted credentials to access MinIO:

```bash
# Configure MinIO client with minted credentials
mc alias set myminio http://localhost:9000 $AWS_ACCESS_KEY_ID $AWS_SECRET_ACCESS_KEY

# List buckets
mc ls myminio/
```

## What's Next?

You've successfully:
- ✅ Set up a local Voidkey environment
- ✅ Authenticated with an identity provider
- ✅ Minted temporary credentials
- ✅ Used those credentials to access cloud resources

### Next Steps

- [**Installation Guide**](/getting-started/installation/) - Set up Voidkey for production
- [**Configuration Guide**](/configuration/guide/) - Configure your own identity and access providers
- [**Architecture Overview**](/architecture/overview/) - Understand how Voidkey works
- [**Examples**](/examples/github-actions/) - See real-world usage examples

## Troubleshooting

### Services not starting?
```bash
# Check logs
docker compose logs -f

# Restart services
docker compose down
docker compose up -d
```

### Authentication failing?
- Ensure Keycloak is fully started (can take 30-60 seconds)
- Check that you're using the correct realm and client configuration
- Verify the token is not expired

### Can't connect to services?
- Ensure ports 8080 (Keycloak), 9000/9001 (MinIO), and 3000 (broker) are not in use
- Check Docker network connectivity

For more help, see our [troubleshooting guide](/development/troubleshooting/) or [file an issue](https://github.com/voidkey-oss/voidkey/issues).