---
title: CLI Installation
description: Install the Voidkey CLI on your system
---

This guide covers installing the Voidkey CLI on various operating systems.

## Pre-built Binaries

The easiest way to install the Voidkey CLI is to download pre-built binaries from the GitHub releases page.

### Download Latest Release

```bash
# Linux (x86_64)
curl -L https://github.com/voidkey-oss/voidkey/releases/latest/download/voidkey-linux-amd64 -o voidkey
chmod +x voidkey
sudo mv voidkey /usr/local/bin/

# Linux (ARM64)
curl -L https://github.com/voidkey-oss/voidkey/releases/latest/download/voidkey-linux-arm64 -o voidkey
chmod +x voidkey
sudo mv voidkey /usr/local/bin/

# macOS (Intel)
curl -L https://github.com/voidkey-oss/voidkey/releases/latest/download/voidkey-darwin-amd64 -o voidkey
chmod +x voidkey
sudo mv voidkey /usr/local/bin/

# macOS (Apple Silicon)
curl -L https://github.com/voidkey-oss/voidkey/releases/latest/download/voidkey-darwin-arm64 -o voidkey
chmod +x voidkey
sudo mv voidkey /usr/local/bin/

# Windows (PowerShell)
Invoke-WebRequest -Uri "https://github.com/voidkey-oss/voidkey/releases/latest/download/voidkey-windows-amd64.exe" -OutFile "voidkey.exe"
```

### Install Script

Use the installation script for automatic platform detection:

```bash
curl -sSL https://raw.githubusercontent.com/voidkey-oss/voidkey/main/install.sh | bash
```

Or with custom installation directory:

```bash
curl -sSL https://raw.githubusercontent.com/voidkey-oss/voidkey/main/install.sh | bash -s -- --dir /usr/local/bin
```

## Package Managers

### Homebrew (macOS/Linux)

```bash
# Add the tap
brew tap voidkey-oss/voidkey

# Install the CLI
brew install voidkey
```

Update to latest version:

```bash
brew update && brew upgrade voidkey
```

### APT (Debian/Ubuntu)

```bash
# Add repository
curl -fsSL https://pkg.voidkey.io/gpg | sudo gpg --dearmor -o /usr/share/keyrings/voidkey.gpg
echo "deb [signed-by=/usr/share/keyrings/voidkey.gpg] https://pkg.voidkey.io/deb stable main" | sudo tee /etc/apt/sources.list.d/voidkey.list

# Update and install
sudo apt update
sudo apt install voidkey
```

### YUM/DNF (Red Hat/CentOS/Fedora)

```bash
# Add repository
sudo tee /etc/yum.repos.d/voidkey.repo <<EOF
[voidkey]
name=Voidkey Repository
baseurl=https://pkg.voidkey.io/rpm
enabled=1
gpgcheck=1
gpgkey=https://pkg.voidkey.io/gpg
EOF

# Install
sudo yum install voidkey  # CentOS/RHEL
# or
sudo dnf install voidkey  # Fedora
```

### Snap (Linux)

```bash
sudo snap install voidkey
```

### Chocolatey (Windows)

```powershell
choco install voidkey
```

### Scoop (Windows)

```powershell
scoop bucket add voidkey https://github.com/voidkey-oss/scoop-bucket
scoop install voidkey
```

## Building from Source

### Prerequisites

- Go 1.21 or later
- Git

### Build Steps

```bash
# Clone the repository
git clone https://github.com/voidkey-oss/voidkey.git
cd voidkey/cli

# Download dependencies
go mod download

# Build the binary
go build -o voidkey main.go

# Install globally
sudo mv voidkey /usr/local/bin/
```

### Build with Make

```bash
# Clone and build
git clone https://github.com/voidkey-oss/voidkey.git
cd voidkey

# Build CLI
make build-cli

# Install
sudo make install-cli
```

### Cross-compilation

```bash
# Build for different platforms
GOOS=linux GOARCH=amd64 go build -o voidkey-linux-amd64 main.go
GOOS=darwin GOARCH=arm64 go build -o voidkey-darwin-arm64 main.go
GOOS=windows GOARCH=amd64 go build -o voidkey-windows-amd64.exe main.go
```

## Docker

Run the CLI using Docker:

```bash
# Pull the image
docker pull voidkey/cli:latest

# Run commands
docker run --rm voidkey/cli:latest version

# With environment variables
docker run --rm \
  -e VOIDKEY_BROKER_URL=https://broker.example.com \
  -e VOIDKEY_OIDC_TOKEN="$OIDC_TOKEN" \
  voidkey/cli:latest mint --keys AWS_DEPLOY
```

Create an alias for easier usage:

```bash
alias voidkey='docker run --rm -e VOIDKEY_BROKER_URL -e VOIDKEY_OIDC_TOKEN voidkey/cli:latest'
voidkey version
```

## Go Install

Install directly using Go:

```bash
go install github.com/voidkey-oss/voidkey/cli@latest
```

This installs to `$GOPATH/bin` (or `$GOBIN` if set).

## Verification

Verify the installation:

```bash
# Check version
voidkey version

# Check help
voidkey --help

# Test connectivity (requires broker URL)
export VOIDKEY_BROKER_URL=https://broker.example.com
voidkey list-keys --help
```

## Platform-Specific Instructions

### Linux

**System-wide installation:**
```bash
sudo curl -L https://github.com/voidkey-oss/voidkey/releases/latest/download/voidkey-linux-amd64 -o /usr/local/bin/voidkey
sudo chmod +x /usr/local/bin/voidkey
```

**User-only installation:**
```bash
mkdir -p ~/.local/bin
curl -L https://github.com/voidkey-oss/voidkey/releases/latest/download/voidkey-linux-amd64 -o ~/.local/bin/voidkey
chmod +x ~/.local/bin/voidkey

# Add to PATH if not already
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### macOS

**Using Homebrew (recommended):**
```bash
brew tap voidkey-oss/voidkey
brew install voidkey
```

**Manual installation:**
```bash
curl -L https://github.com/voidkey-oss/voidkey/releases/latest/download/voidkey-darwin-arm64 -o voidkey
chmod +x voidkey
sudo mv voidkey /usr/local/bin/

# For Intel Macs, use voidkey-darwin-amd64
```

**Bypassing Gatekeeper:**
If macOS blocks the binary, you may need to allow it:
```bash
sudo xattr -rd com.apple.quarantine /usr/local/bin/voidkey
```

### Windows

**Using Chocolatey:**
```powershell
choco install voidkey
```

**Manual installation:**
1. Download `voidkey-windows-amd64.exe`
2. Rename to `voidkey.exe`
3. Place in a directory in your PATH (e.g., `C:\Program Files\voidkey\`)
4. Add the directory to your PATH environment variable

**PowerShell:**
```powershell
# Create directory
New-Item -ItemType Directory -Force -Path "C:\Program Files\voidkey"

# Download
Invoke-WebRequest -Uri "https://github.com/voidkey-oss/voidkey/releases/latest/download/voidkey-windows-amd64.exe" -OutFile "C:\Program Files\voidkey\voidkey.exe"

# Add to PATH (requires admin)
$env:PATH += ";C:\Program Files\voidkey"
[Environment]::SetEnvironmentVariable("Path", $env:PATH, [EnvironmentVariableTarget]::Machine)
```

## CI/CD Installation

### GitHub Actions

```yaml
- name: Install Voidkey CLI
  run: |
    curl -L https://github.com/voidkey-oss/voidkey/releases/latest/download/voidkey-linux-amd64 -o voidkey
    chmod +x voidkey
    sudo mv voidkey /usr/local/bin/

- name: Use Voidkey
  run: voidkey mint --keys AWS_DEPLOY
  env:
    VOIDKEY_BROKER_URL: ${{ vars.VOIDKEY_BROKER_URL }}
    VOIDKEY_OIDC_TOKEN: ${{ steps.get-token.outputs.token }}
```

### GitLab CI

```yaml
before_script:
  - curl -L https://github.com/voidkey-oss/voidkey/releases/latest/download/voidkey-linux-amd64 -o voidkey
  - chmod +x voidkey
  - mv voidkey /usr/local/bin/

deploy:
  script:
    - voidkey mint --keys AWS_DEPLOY
  variables:
    VOIDKEY_BROKER_URL: "https://broker.example.com"
    VOIDKEY_OIDC_TOKEN: "$CI_JOB_JWT_V2"
```

### Jenkins

```groovy
pipeline {
    agent any
    
    stages {
        stage('Install CLI') {
            steps {
                sh '''
                    curl -L https://github.com/voidkey-oss/voidkey/releases/latest/download/voidkey-linux-amd64 -o voidkey
                    chmod +x voidkey
                    sudo mv voidkey /usr/local/bin/
                '''
            }
        }
        
        stage('Deploy') {
            steps {
                withCredentials([string(credentialsId: 'oidc-token', variable: 'VOIDKEY_OIDC_TOKEN')]) {
                    sh 'voidkey mint --keys AWS_DEPLOY'
                }
            }
        }
    }
}
```

## Shell Completion

Enable shell completion for better CLI experience:

### Bash

```bash
# Generate completion script
voidkey completion bash > /etc/bash_completion.d/voidkey

# Or for user only
voidkey completion bash > ~/.local/share/bash-completion/completions/voidkey
```

### Zsh

```bash
# Generate completion script
voidkey completion zsh > "${fpath[1]}/_voidkey"

# Reload completions
autoload -U compinit && compinit
```

### Fish

```bash
voidkey completion fish > ~/.config/fish/completions/voidkey.fish
```

### PowerShell

```powershell
voidkey completion powershell | Out-String | Invoke-Expression
```

Add to your PowerShell profile for persistence:
```powershell
voidkey completion powershell >> $PROFILE
```

## Troubleshooting

### Permission Denied

If you get permission denied errors:

```bash
# Make sure binary is executable
chmod +x /usr/local/bin/voidkey

# Check if directory is in PATH
echo $PATH | grep -q /usr/local/bin && echo "Found" || echo "Not found"

# Add to PATH if missing
echo 'export PATH="/usr/local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

### Command Not Found

If the command is not found after installation:

```bash
# Check if binary exists
ls -la /usr/local/bin/voidkey

# Check PATH
echo $PATH

# Try absolute path
/usr/local/bin/voidkey version

# Reload shell
source ~/.bashrc  # or ~/.zshrc
```

### SSL/TLS Issues

If you encounter TLS errors:

```bash
# Update CA certificates
sudo apt update && sudo apt install ca-certificates  # Ubuntu/Debian
sudo yum update ca-certificates                      # CentOS/RHEL

# Or specify custom CA bundle
export SSL_CERT_FILE=/path/to/ca-bundle.crt
```

### Proxy Issues

If behind a corporate proxy:

```bash
export HTTP_PROXY=http://proxy.company.com:8080
export HTTPS_PROXY=https://proxy.company.com:8080
export NO_PROXY=localhost,127.0.0.1,.company.com
```

## Updating

### Automatic Updates

The CLI can check for updates:

```bash
# Check for newer version
voidkey version --check-update

# Update if available (where supported)
voidkey update
```

### Manual Updates

Re-run the installation command to get the latest version:

```bash
# Using install script
curl -sSL https://raw.githubusercontent.com/voidkey-oss/voidkey/main/install.sh | bash

# Using package manager
brew upgrade voidkey  # Homebrew
sudo apt update && sudo apt upgrade voidkey  # APT
```

## Next Steps

- [CLI Commands](/cli/commands/) - Learn the available commands
- [CLI Configuration](/cli/configuration/) - Configure the CLI
- [Quick Start](/getting-started/quickstart/) - Try the CLI with our sandbox
- [GitHub Actions Example](/examples/github-actions/) - Use in CI/CD