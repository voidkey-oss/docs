---
title: CLI Commands Reference
description: Complete reference for Voidkey CLI commands
---

The Voidkey CLI provides a user-friendly interface for minting credentials from the command line.

## Installation

See the [CLI Installation Guide](/cli/installation/) for detailed installation instructions.

## Global Options

These options are available for all commands:

```bash
voidkey [command] [flags]

Global Flags:
  --broker-url string   Voidkey broker URL (env: VOIDKEY_BROKER_URL)
  --config string       Config file path (default: ~/.voidkey/config.yaml)
  --debug              Enable debug logging
  --help               Show help for command
  --no-color           Disable colored output
  --timeout duration   Request timeout (default: 30s)
  --version            Show version information
```

## Commands

### voidkey mint

Mint temporary credentials from the broker.

#### Synopsis

```bash
voidkey mint [flags]
```

#### Description

The `mint` command requests temporary credentials from the Voidkey broker. You must provide an OIDC token (via environment variable or flag) and specify which keys to mint.

#### Flags

```bash
Flags:
  --all                Mint all available keys
  --keys strings       Comma-separated list of keys to mint
  --output string      Output format: env, json, yaml (default: env)
  --token string       OIDC token (env: VOIDKEY_OIDC_TOKEN)
  --token-file string  Read OIDC token from file
```

#### Examples

**Mint specific keys with environment output:**
```bash
# Set token via environment
export VOIDKEY_OIDC_TOKEN="eyJhbGciOiJSUzI1NiIs..."

# Mint specific keys
voidkey mint --keys AWS_DEPLOY,GCP_READONLY

# Output:
export AWS_ACCESS_KEY_ID="ASIATESTACCESSKEY"
export AWS_SECRET_ACCESS_KEY="wJalrXUtnFEMI/K7MDENG/bPxRfiCY"
export AWS_SESSION_TOKEN="FwoGZXIvYXdzEBYaD..."
export GOOGLE_OAUTH_ACCESS_TOKEN="ya29.A0ARrdaM..."
```

**Mint all available keys:**
```bash
voidkey mint --all
```

**Use JSON output format:**
```bash
voidkey mint --keys AWS_DEPLOY --output json

# Output:
{
  "AWS_DEPLOY": {
    "AWS_ACCESS_KEY_ID": "ASIATESTACCESSKEY",
    "AWS_SECRET_ACCESS_KEY": "wJalrXUtnFEMI/K7MDENG/bPxRfiCY",
    "AWS_SESSION_TOKEN": "FwoGZXIvYXdzEBYaD..."
  }
}
```

**Read token from file:**
```bash
# Useful in CI/CD where token is written to file
voidkey mint --token-file /tmp/oidc-token --keys AWS_DEPLOY
```

**Export credentials directly:**
```bash
# Evaluate the output to export variables
eval "$(voidkey mint --keys AWS_DEPLOY)"

# Now use the credentials
aws s3 ls
```

#### Output Formats

**env (default)**
```bash
export KEY_NAME="value"
export ANOTHER_KEY="another_value"
```

**json**
```json
{
  "KEY_SET": {
    "KEY_NAME": "value",
    "ANOTHER_KEY": "another_value"
  }
}
```

**yaml**
```yaml
KEY_SET:
  KEY_NAME: value
  ANOTHER_KEY: another_value
```

### voidkey list-keys

List available keys for the current identity.

#### Synopsis

```bash
voidkey list-keys [flags]
```

#### Description

Shows all credential keys available to the authenticated identity.

#### Flags

```bash
Flags:
  --format string   Output format: table, json, yaml (default: table)
  --token string    OIDC token (env: VOIDKEY_OIDC_TOKEN)
```

#### Examples

**List keys in table format:**
```bash
voidkey list-keys

# Output:
Available keys for subject: repo:myorg/myapp:ref:refs/heads/main

NAME              PROVIDER    MAX_DURATION  DESCRIPTION
AWS_DEPLOY        aws-prod    1h            AWS deployment credentials
GCP_READONLY      gcp-prod    2h            GCP read-only access
MINIO_STORAGE     minio       30m           MinIO storage access
```

**JSON output:**
```bash
voidkey list-keys --format json

# Output:
{
  "subject": "repo:myorg/myapp:ref:refs/heads/main",
  "idp": "github-actions",
  "keys": [
    {
      "name": "AWS_DEPLOY",
      "provider": "aws-prod",
      "maxDuration": 3600,
      "description": "AWS deployment credentials"
    }
  ]
}
```

### voidkey validate

Validate OIDC token and show claims.

#### Synopsis

```bash
voidkey validate [flags]
```

#### Description

Validates the OIDC token and displays its claims. Useful for debugging authentication issues.

#### Flags

```bash
Flags:
  --token string    OIDC token (env: VOIDKEY_OIDC_TOKEN)
  --verbose        Show all token claims
```

#### Examples

**Basic validation:**
```bash
voidkey validate

# Output:
Token Status: VALID
Subject: repo:myorg/myapp:ref:refs/heads/main
Issuer: https://token.actions.githubusercontent.com
Expires: 2024-01-15T11:30:00Z (in 14 minutes)
```

**Verbose output:**
```bash
voidkey validate --verbose

# Output:
Token Status: VALID

Claims:
  aud: ["https://github.com/myorg"]
  exp: 1705318200
  iat: 1705314600
  iss: "https://token.actions.githubusercontent.com"
  jti: "example-jti"
  nbf: 1705314600
  ref: "refs/heads/main"
  repository: "myorg/myapp"
  repository_owner: "myorg"
  run_id: "7234567890"
  sub: "repo:myorg/myapp:ref:refs/heads/main"
```

### voidkey config

Manage CLI configuration.

#### Synopsis

```bash
voidkey config [subcommand] [flags]
```

#### Subcommands

**voidkey config init**

Initialize configuration file:
```bash
voidkey config init

# Creates ~/.voidkey/config.yaml with defaults
```

**voidkey config show**

Display current configuration:
```bash
voidkey config show

# Output:
broker_url: https://voidkey.example.com
output_format: env
timeout: 30s
```

**voidkey config set**

Set configuration values:
```bash
voidkey config set broker_url https://voidkey.example.com
voidkey config set output_format json
voidkey config set timeout 60s
```

### voidkey version

Show version information.

#### Synopsis

```bash
voidkey version [flags]
```

#### Flags

```bash
Flags:
  --format string   Output format: text, json (default: text)
```

#### Examples

```bash
voidkey version

# Output:
voidkey version 0.8.0
Built: 2024-01-15T10:00:00Z
Go version: go1.21.5
OS/Arch: darwin/arm64
```

```bash
voidkey version --format json

# Output:
{
  "version": "0.8.0",
  "buildTime": "2024-01-15T10:00:00Z",
  "goVersion": "go1.21.5",
  "platform": "darwin/arm64"
}
```

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

## Configuration File

The CLI can be configured via YAML file:

```yaml
# ~/.voidkey/config.yaml
broker_url: https://voidkey.example.com
output_format: json
timeout: 60s
debug: false

# Default keys to mint when --all is not specified
default_keys:
  - AWS_DEPLOY
  - GCP_READONLY

# Aliases for common key combinations
aliases:
  deploy:
    - AWS_DEPLOY
    - DOCKER_REGISTRY
  monitoring:
    - PROMETHEUS_READ
    - GRAFANA_READ
```

## Exit Codes

The CLI uses standard exit codes:

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Command line usage error |
| 3 | Configuration error |
| 4 | Authentication error |
| 5 | Authorization error |
| 6 | Network/timeout error |
| 7 | Server error |

## Shell Completion

Generate shell completion scripts:

**Bash:**
```bash
voidkey completion bash > /etc/bash_completion.d/voidkey
```

**Zsh:**
```bash
voidkey completion zsh > "${fpath[1]}/_voidkey"
```

**Fish:**
```bash
voidkey completion fish > ~/.config/fish/completions/voidkey.fish
```

**PowerShell:**
```powershell
voidkey completion powershell | Out-String | Invoke-Expression
```

## Advanced Usage

### CI/CD Integration

**GitHub Actions:**
```yaml
- name: Configure AWS credentials
  run: |
    eval "$(voidkey mint --keys AWS_DEPLOY)"
  env:
    VOIDKEY_OIDC_TOKEN: ${{ steps.token.outputs.token }}
    VOIDKEY_BROKER_URL: ${{ vars.VOIDKEY_BROKER_URL }}
```

**GitLab CI:**
```yaml
deploy:
  script:
    - export VOIDKEY_OIDC_TOKEN="${CI_JOB_JWT_V2}"
    - eval "$(voidkey mint --keys AWS_DEPLOY)"
    - aws s3 sync ./dist s3://my-bucket/
```

### Scripting

**Error handling in scripts:**
```bash
#!/bin/bash
set -e

# Mint credentials with error handling
if ! output=$(voidkey mint --keys AWS_DEPLOY 2>&1); then
  echo "Failed to mint credentials: $output" >&2
  exit 1
fi

# Export the credentials
eval "$output"

# Use the credentials
aws s3 ls
```

**JSON parsing with jq:**
```bash
# Get specific credential value
ACCESS_KEY=$(voidkey mint --keys AWS_DEPLOY --output json | jq -r '.AWS_DEPLOY.AWS_ACCESS_KEY_ID')

# Check if key exists
if voidkey list-keys --format json | jq -e '.keys[] | select(.name == "AWS_DEPLOY")' > /dev/null; then
  echo "AWS_DEPLOY key is available"
fi
```

## Troubleshooting

### Common Issues

**"No OIDC token provided"**
```bash
# Ensure token is set
export VOIDKEY_OIDC_TOKEN="your-token"
# Or use --token flag
voidkey mint --token "your-token" --keys AWS_DEPLOY
```

**"Connection refused"**
```bash
# Check broker URL
voidkey config show
# Update if needed
voidkey config set broker_url https://correct-url.example.com
```

**"Key not found"**
```bash
# List available keys first
voidkey list-keys
# Use exact key name
voidkey mint --keys EXACT_KEY_NAME
```

### Debug Mode

Enable debug logging for troubleshooting:

```bash
# Via flag
voidkey --debug mint --keys AWS_DEPLOY

# Via environment
export VOIDKEY_DEBUG=true
voidkey mint --keys AWS_DEPLOY
```

Debug output includes:
- HTTP request/response details
- Token validation steps
- Configuration loading
- Error stack traces

## Next Steps

- [CLI Installation](/cli/installation/) - Installation guide
- [CLI Configuration](/cli/configuration/) - Advanced configuration
- [Examples](/examples/cicd/) - Real-world usage examples
- [API Reference](/api/rest/) - REST API documentation