---
title: CLI Configuration
description: Configure the Voidkey CLI for your environment
---

This guide covers configuring the Voidkey CLI for different environments and use cases.

## Configuration Methods

The Voidkey CLI can be configured in multiple ways, with the following precedence order (highest to lowest):

1. **Command-line flags** - Override everything
2. **Environment variables** - Per-session configuration
3. **Configuration file** - Persistent user/project settings
4. **Default values** - Built-in defaults

## Environment Variables

The CLI respects these environment variables:

| Variable | Description | Default |
|----------|-------------|---------|
| `VOIDKEY_BROKER_URL` | Broker endpoint URL | - |
| `VOIDKEY_OIDC_TOKEN` | OIDC authentication token | - |
| `VOIDKEY_OUTPUT_FORMAT` | Default output format | `env` |
| `VOIDKEY_CONFIG_PATH` | Configuration file path | `~/.voidkey/config.yaml` |
| `VOIDKEY_DEBUG` | Enable debug logging | `false` |
| `VOIDKEY_NO_COLOR` | Disable colored output | `false` |
| `VOIDKEY_TIMEOUT` | Request timeout | `30s` |

### Setting Environment Variables

**Bash/Zsh:**
```bash
export VOIDKEY_BROKER_URL="https://voidkey.example.com"
export VOIDKEY_OIDC_TOKEN="eyJhbGciOiJSUzI1NiIs..."
export VOIDKEY_OUTPUT_FORMAT="json"
```

**Fish:**
```fish
set -gx VOIDKEY_BROKER_URL "https://voidkey.example.com"
set -gx VOIDKEY_OIDC_TOKEN "eyJhbGciOiJSUzI1NiIs..."
```

**PowerShell:**
```powershell
$env:VOIDKEY_BROKER_URL = "https://voidkey.example.com"
$env:VOIDKEY_OIDC_TOKEN = "eyJhbGciOiJSUzI1NiIs..."
```

**Windows Command Prompt:**
```cmd
set VOIDKEY_BROKER_URL=https://voidkey.example.com
set VOIDKEY_OIDC_TOKEN=eyJhbGciOiJSUzI1NiIs...
```

## Configuration File

The CLI uses a YAML configuration file for persistent settings.

### Default Location

- **Linux/macOS**: `~/.voidkey/config.yaml`
- **Windows**: `%USERPROFILE%\.voidkey\config.yaml`

### Creating Configuration

Initialize a configuration file:

```bash
voidkey config init
```

This creates a default configuration:

```yaml
# ~/.voidkey/config.yaml
broker_url: ""
output_format: env
timeout: 30s
debug: false

# Default keys to use when --all is not specified
default_keys: []

# Key aliases for common combinations
aliases: {}
```

### Configuration Options

| Option | Type | Description | Example |
|--------|------|-------------|---------|
| `broker_url` | string | Broker endpoint URL | `https://voidkey.example.com` |
| `output_format` | string | Default output format (`env`, `json`, `yaml`) | `json` |
| `timeout` | string | Request timeout duration | `60s` |
| `debug` | boolean | Enable debug logging | `true` |
| `default_keys` | array | Keys to mint when no --keys specified | `["AWS_DEPLOY"]` |
| `aliases` | object | Named key combinations | See below |

### Complete Configuration Example

```yaml
# Broker connection
broker_url: https://voidkey.example.com
timeout: 45s

# Output preferences
output_format: json
debug: false

# Default behavior
default_keys:
  - AWS_DEV
  - MINIO_LOCAL

# Key aliases for common scenarios
aliases:
  # Development environment
  dev:
    - AWS_DEV
    - MINIO_LOCAL
    - GCP_DEV
  
  # Production deployment
  prod:
    - AWS_PROD_DEPLOY
    - DOCKER_REGISTRY_PROD
  
  # Monitoring and observability
  monitoring:
    - PROMETHEUS_READ
    - GRAFANA_ADMIN
    - ELASTICSEARCH_READ

# Environment-specific overrides
environments:
  development:
    broker_url: http://localhost:3000
    debug: true
    timeout: 10s
  
  staging:
    broker_url: https://voidkey-staging.example.com
    timeout: 30s
  
  production:
    broker_url: https://voidkey.example.com
    timeout: 60s
    debug: false
```

## Configuration Commands

### Initialize Configuration

Create a new configuration file with defaults:

```bash
voidkey config init

# With custom path
voidkey config init --config /path/to/config.yaml
```

### View Configuration

Display current configuration:

```bash
# Show all configuration
voidkey config show

# Show specific value
voidkey config show broker_url
voidkey config show output_format
```

### Set Configuration Values

Update configuration values:

```bash
# Set broker URL
voidkey config set broker_url https://voidkey.example.com

# Set output format
voidkey config set output_format json

# Set timeout
voidkey config set timeout 60s

# Enable debug mode
voidkey config set debug true

# Set default keys
voidkey config set default_keys AWS_DEPLOY,GCP_READONLY
```

### Remove Configuration Values

```bash
# Remove specific value (revert to default)
voidkey config unset broker_url

# Clear default keys
voidkey config unset default_keys
```

## Aliases

Create aliases for common key combinations:

### Setting Aliases

```bash
# Create alias for development keys
voidkey config set aliases.dev AWS_DEV,MINIO_LOCAL,GCP_DEV

# Create alias for production deployment
voidkey config set aliases.prod AWS_PROD_DEPLOY,DOCKER_REGISTRY

# Create alias for monitoring
voidkey config set aliases.monitoring PROMETHEUS_READ,GRAFANA_ADMIN
```

### Using Aliases

```bash
# Use alias instead of listing individual keys
voidkey mint --keys @dev

# Equivalent to:
voidkey mint --keys AWS_DEV,MINIO_LOCAL,GCP_DEV

# Combine aliases with individual keys
voidkey mint --keys @prod,ADDITIONAL_KEY
```

### Listing Aliases

```bash
# Show all aliases
voidkey config show aliases

# Show specific alias
voidkey config show aliases.dev
```

## Environment-Specific Configuration

### Multiple Environments

Configure different environments:

```yaml
# ~/.voidkey/config.yaml
environments:
  local:
    broker_url: http://localhost:3000
    debug: true
  
  dev:
    broker_url: https://voidkey-dev.example.com
    timeout: 30s
  
  staging:
    broker_url: https://voidkey-staging.example.com
  
  prod:
    broker_url: https://voidkey.example.com
    timeout: 60s
    debug: false
```

### Using Environments

```bash
# Use specific environment
voidkey --env dev mint --keys AWS_DEPLOY

# Set default environment
export VOIDKEY_ENV=staging
voidkey mint --keys AWS_DEPLOY
```

## Project-Specific Configuration

Create project-specific configuration files:

### Project Configuration File

```yaml
# .voidkey.yaml (in project root)
broker_url: https://company-voidkey.internal
output_format: json

default_keys:
  - AWS_PROJECT_DEPLOY
  - GCP_PROJECT_READ

aliases:
  deploy:
    - AWS_PROJECT_DEPLOY
    - DOCKER_REGISTRY_PUSH
  
  test:
    - AWS_PROJECT_TEST
    - MINIO_PROJECT_TEST
```

### Using Project Configuration

```bash
# CLI automatically finds .voidkey.yaml in current directory
cd /path/to/project
voidkey mint --keys @deploy

# Or specify explicitly
voidkey --config .voidkey.yaml mint --keys @deploy
```

## Token Management

### Token Sources

Configure how to obtain OIDC tokens:

```yaml
# ~/.voidkey/config.yaml
token_sources:
  github:
    command: "gh auth token --scopes read:org"
    cache_duration: 300s
  
  auth0:
    command: "auth0 token"
    cache_duration: 600s
  
  gcloud:
    command: "gcloud auth print-identity-token"
    cache_duration: 900s
```

### Token Caching

Enable local token caching:

```yaml
token_cache:
  enabled: true
  directory: ~/.voidkey/cache
  max_age: 300s  # 5 minutes
```

Use cached tokens:

```bash
# Cache token from command
voidkey config set-token --source github

# Use cached token
voidkey mint --keys AWS_DEPLOY  # Uses cached token automatically
```

## Advanced Configuration

### Custom Output Templates

Define custom output templates:

```yaml
output_templates:
  custom_env: |
    {{- range $key, $creds := .credentials }}
    {{- range $name, $value := $creds }}
    export {{ $name }}="{{ $value }}"
    {{- end }}
    {{- end }}
  
  docker_env: |
    {{- range $key, $creds := .credentials }}
    {{- range $name, $value := $creds }}
    {{ $name }}={{ $value }}
    {{- end }}
    {{- end }}
```

Use custom templates:

```bash
voidkey mint --keys AWS_DEPLOY --output custom_env
voidkey mint --keys AWS_DEPLOY --output docker_env
```

### HTTP Configuration

Configure HTTP client behavior:

```yaml
http:
  timeout: 30s
  retry_attempts: 3
  retry_delay: 1s
  user_agent: "voidkey-cli/0.8.0"
  
  # TLS configuration
  tls:
    insecure: false
    ca_file: /path/to/ca.pem
    cert_file: /path/to/client.pem
    key_file: /path/to/client-key.pem
  
  # Proxy configuration
  proxy:
    http: http://proxy.example.com:8080
    https: https://proxy.example.com:8080
    no_proxy:
      - localhost
      - "*.internal"
```

### Logging Configuration

Configure logging behavior:

```yaml
logging:
  level: info  # debug, info, warn, error
  format: text  # text, json
  file: ~/.voidkey/logs/cli.log
  
  # Rotate logs
  rotate:
    max_size: 10MB
    max_files: 5
    max_age: 30d
```

## Global vs Local Configuration

### Global Configuration

Stored in user home directory:
- **Linux/macOS**: `~/.voidkey/config.yaml`
- **Windows**: `%USERPROFILE%\.voidkey\config.yaml`

```bash
# Edit global config
voidkey config edit

# Show global config location
voidkey config path
```

### Local Configuration

Project-specific configuration files:

```bash
# .voidkey.yaml in current directory
voidkey mint --keys AWS_DEPLOY

# Custom local config
voidkey --config ./my-config.yaml mint --keys AWS_DEPLOY
```

### Configuration Merging

Configuration sources are merged in this order:
1. Global configuration (`~/.voidkey/config.yaml`)
2. Local configuration (`.voidkey.yaml`)
3. Environment variables
4. Command-line flags

## Configuration Validation

### Validate Configuration

Check configuration file syntax:

```bash
# Validate current configuration
voidkey config validate

# Validate specific file
voidkey config validate --config /path/to/config.yaml
```

### Configuration Schema

The CLI validates configuration against this schema:

```yaml
type: object
properties:
  broker_url:
    type: string
    format: uri
  output_format:
    type: string
    enum: [env, json, yaml]
  timeout:
    type: string
    pattern: '^\d+[smh]$'
  debug:
    type: boolean
  default_keys:
    type: array
    items:
      type: string
  aliases:
    type: object
    additionalProperties:
      type: array
      items:
        type: string
```

## Troubleshooting Configuration

### Debug Configuration Loading

Enable debug mode to see configuration loading:

```bash
voidkey --debug config show
```

Output includes:
- Configuration file locations checked
- Values loaded from each source
- Final merged configuration

### Common Issues

**Configuration file not found:**
```bash
# Check expected location
voidkey config path

# Create missing directory
mkdir -p ~/.voidkey

# Initialize configuration
voidkey config init
```

**Invalid YAML syntax:**
```bash
# Validate configuration
voidkey config validate

# Check YAML syntax
yamllint ~/.voidkey/config.yaml
```

**Permission issues:**
```bash
# Check file permissions
ls -la ~/.voidkey/config.yaml

# Fix permissions
chmod 600 ~/.voidkey/config.yaml
```

## Examples

### Developer Setup

```yaml
# ~/.voidkey/config.yaml
broker_url: https://voidkey-dev.company.com
output_format: json
debug: true
timeout: 30s

default_keys:
  - AWS_DEV
  - MINIO_LOCAL

aliases:
  full: 
    - AWS_DEV
    - GCP_DEV
    - MINIO_LOCAL
    - DOCKER_DEV
```

Usage:
```bash
# Quick development credential minting
voidkey mint  # Uses default_keys

# Full development environment
voidkey mint --keys @full
```

### CI/CD Setup

```bash
# Environment variables in CI/CD
export VOIDKEY_BROKER_URL="https://voidkey.company.com"
export VOIDKEY_OIDC_TOKEN="$CI_OIDC_TOKEN"
export VOIDKEY_OUTPUT_FORMAT="env"
export VOIDKEY_TIMEOUT="60s"

# No configuration file needed
voidkey mint --keys AWS_PROD_DEPLOY
```

### Production Setup

```yaml
# ~/.voidkey/config.yaml
broker_url: https://voidkey.company.com
timeout: 60s
debug: false

# No default keys for security
default_keys: []

# Specific production aliases
aliases:
  deploy:
    - AWS_PROD_DEPLOY
    - DOCKER_REGISTRY_PUSH
  
  monitor:
    - PROMETHEUS_READ
    - GRAFANA_READ
```

## Next Steps

- [CLI Commands](/cli/commands/) - Learn available commands
- [API Authentication](/api/authentication/) - Understand token requirements
- [Examples](/examples/github-actions/) - Real-world usage examples
- [Troubleshooting](/development/troubleshooting/) - Solve common issues