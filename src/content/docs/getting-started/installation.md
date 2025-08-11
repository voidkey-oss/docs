---
title: Installation
description: Install and configure Voidkey for different environments
---

This guide covers installing Voidkey components for various deployment scenarios.

## System Requirements

### Broker Server
- Node.js 18+ and npm 9+
- 512MB RAM minimum (1GB recommended)
- Network access to identity providers and cloud services

### CLI
- Go 1.21+ for building from source
- Or download pre-built binaries for your platform

### Runtime Dependencies
- HTTPS connectivity to IdP JWKS endpoints
- Network access to cloud provider APIs

## Installing the Broker Server

### From Source

```bash
# Clone the repository
git clone https://github.com/voidkey-oss/voidkey.git
cd voidkey

# Install and build broker-core
cd broker-core
npm install
npm run build

# Install and build broker-server
cd ../broker-server
npm install
npm run build
```

### Using Docker

```bash
# Pull the official image
docker pull voidkey/broker:latest

# Run with configuration
docker run -d \
  -p 3000:3000 \
  -v /path/to/config.yaml:/app/config/config.yaml \
  voidkey/broker:latest
```

### Using Docker Compose

Create a `docker-compose.yml`:

```yaml
version: '3.8'
services:
  voidkey-broker:
    image: voidkey/broker:latest
    ports:
      - "3000:3000"
    volumes:
      - ./config.yaml:/app/config/config.yaml
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
    restart: unless-stopped
```

## Installing the CLI

### Pre-built Binaries

Download the latest release for your platform:

```bash
# Linux (amd64)
curl -L https://github.com/voidkey-oss/voidkey/releases/latest/download/voidkey-linux-amd64 -o voidkey
chmod +x voidkey

# macOS (arm64)
curl -L https://github.com/voidkey-oss/voidkey/releases/latest/download/voidkey-darwin-arm64 -o voidkey
chmod +x voidkey

# Windows
curl -L https://github.com/voidkey-oss/voidkey/releases/latest/download/voidkey-windows-amd64.exe -o voidkey.exe
```

### From Source

```bash
cd cli
go build -o voidkey main.go

# Install globally
sudo mv voidkey /usr/local/bin/
```

### Using Go Install

```bash
go install github.com/voidkey-oss/voidkey/cli@latest
```

## Configuration

### Broker Server Configuration

Create a `config.yaml` file:

```yaml
# Basic configuration example
brokerIdp:
  name: "keycloak"
  issuer: "https://auth.example.com/realms/voidkey"
  audience: "voidkey-broker"
  clientId: "broker-service"
  clientSecret: "${BROKER_CLIENT_SECRET}"

clientIdps:
  - name: "github-actions"
    issuer: "https://token.actions.githubusercontent.com"
    audience: "https://github.com/myorg"

accessProviders:
  - name: "aws-prod"
    type: "aws-sts"
    endpoint: "https://sts.amazonaws.com"
    region: "us-east-1"

clientIdentities:
  - subject: "repo:myorg/myapp:ref:refs/heads/main"
    idp: "github-actions"
    keys:
      AWS_DEPLOYMENT:
        provider: "aws-prod"
        roleArn: "arn:aws:iam::123456789012:role/DeploymentRole"
        duration: 3600
```

### CLI Configuration

Configure the CLI using environment variables:

```bash
# Broker endpoint
export VOIDKEY_BROKER_URL="https://voidkey.example.com"

# OIDC token (usually set by CI/CD platform)
export VOIDKEY_OIDC_TOKEN="eyJhbGciOiJSUzI1NiIs..."

# Optional: default output format
export VOIDKEY_OUTPUT_FORMAT="env"
```

Or create a config file at `~/.voidkey/config.yaml`:

```yaml
broker_url: https://voidkey.example.com
output_format: env
```

## Platform-Specific Installation

### Kubernetes

Deploy using Helm:

```bash
# Add the Voidkey Helm repository
helm repo add voidkey https://charts.voidkey.io
helm repo update

# Install with custom values
helm install voidkey voidkey/voidkey-broker \
  --set config.brokerIdp.clientSecret=$BROKER_SECRET \
  --set ingress.enabled=true \
  --set ingress.hosts[0].host=voidkey.example.com
```

### AWS ECS

Use the provided CloudFormation template:

```bash
aws cloudformation create-stack \
  --stack-name voidkey-broker \
  --template-body file://deploy/aws/ecs-stack.yaml \
  --parameters \
    ParameterKey=BrokerSecret,ParameterValue=$BROKER_SECRET \
    ParameterKey=ConfigS3Bucket,ParameterValue=my-config-bucket
```

### Google Cloud Run

Deploy as a serverless container:

```bash
gcloud run deploy voidkey-broker \
  --image voidkey/broker:latest \
  --port 3000 \
  --set-env-vars NODE_ENV=production \
  --set-secrets BROKER_CLIENT_SECRET=broker-secret:latest
```

## Verifying Installation

### Broker Server

Check the health endpoint:

```bash
curl https://voidkey.example.com/health
# Expected: {"status":"ok","timestamp":"..."}
```

List available IdP providers:

```bash
curl https://voidkey.example.com/credentials/idp-providers
```

### CLI

Verify the CLI installation:

```bash
voidkey version
# Expected: voidkey version 0.8.0

voidkey --help
# Shows available commands
```

## Security Considerations

### TLS/HTTPS
- Always use HTTPS in production
- Configure proper TLS certificates
- Consider using a reverse proxy (nginx, Traefik)

### Secrets Management
- Store broker secrets in environment variables or secret managers
- Never commit secrets to version control
- Rotate secrets regularly

### Network Security
- Restrict broker access to authorized networks
- Use firewall rules or security groups
- Consider VPN or private networking for sensitive deployments

## Next Steps

- [Configure identity providers](/configuration/identity-providers/)
- [Set up access providers](/configuration/access-providers/)
- [Deploy to production](/deployment/production/)
- [Integrate with CI/CD](/examples/cicd/)