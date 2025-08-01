---
title: CI/CD Integration Examples
description: Examples of integrating Voidkey with CI/CD pipelines
---

This guide provides practical examples of integrating Voidkey with various CI/CD platforms for secure credential management.

## GitHub Actions Integration

### Basic Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write  # Required for OIDC token
      contents: read
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Voidkey CLI
        run: |
          curl -L -o voidkey https://github.com/voidkey-oss/voidkey/releases/latest/download/voidkey-linux-amd64
          chmod +x voidkey
          sudo mv voidkey /usr/local/bin/
      
      - name: Get temporary AWS credentials
        run: |
          # Get GitHub Actions OIDC token
          GITHUB_TOKEN=$(curl -H "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
            "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=https://github.com/myorg" | jq -r .value)
          
          # Mint AWS credentials using Voidkey
          eval $(voidkey mint \
            --keys AWS_PRODUCTION_DEPLOY \
            --broker-url https://voidkey.company.com \
            --token "$GITHUB_TOKEN" \
            --output env)
      
      - name: Deploy to S3
        run: |
          aws s3 sync ./dist s3://my-production-bucket/
          aws cloudfront create-invalidation --distribution-id E1234567890 --paths "/*"
```

### Multi-Stage Deployment

```yaml
# .github/workflows/multi-stage-deploy.yml
name: Multi-Stage Deployment

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  determine-environment:
    runs-on: ubuntu-latest
    outputs:
      environment: ${{ steps.env.outputs.environment }}
      keys: ${{ steps.env.outputs.keys }}
    steps:
      - id: env
        run: |
          if [[ "${{ github.ref }}" == "refs/heads/main" ]]; then
            echo "environment=production" >> $GITHUB_OUTPUT
            echo "keys=AWS_PROD_DEPLOY,GCP_PROD_DEPLOY" >> $GITHUB_OUTPUT
          elif [[ "${{ github.ref }}" == "refs/heads/develop" ]]; then
            echo "environment=staging" >> $GITHUB_OUTPUT
            echo "keys=AWS_STAGING_DEPLOY" >> $GITHUB_OUTPUT
          else
            echo "environment=preview" >> $GITHUB_OUTPUT
            echo "keys=AWS_PREVIEW_DEPLOY" >> $GITHUB_OUTPUT
          fi

  deploy:
    needs: determine-environment
    runs-on: ubuntu-latest
    environment: ${{ needs.determine-environment.outputs.environment }}
    permissions:
      id-token: write
      contents: read
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Voidkey
        uses: voidkey/setup-voidkey@v1
        with:
          version: 'latest'
      
      - name: Get credentials for ${{ needs.determine-environment.outputs.environment }}
        run: |
          GITHUB_TOKEN=$(curl -H "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
            "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=https://github.com/myorg" | jq -r .value)
          
          voidkey mint \
            --keys ${{ needs.determine-environment.outputs.keys }} \
            --broker-url ${{ vars.VOIDKEY_BROKER_URL }} \
            --token "$GITHUB_TOKEN" \
            --output dotenv > .env.credentials
          
          source .env.credentials
      
      - name: Deploy
        run: |
          source .env.credentials
          ./scripts/deploy.sh ${{ needs.determine-environment.outputs.environment }}
```

### Matrix Deployments

```yaml
# .github/workflows/matrix-deploy.yml
name: Multi-Cloud Deployment

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy to'
        required: true
        default: 'staging'
        type: choice
        options:
        - staging
        - production

jobs:
  deploy:
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    
    strategy:
      matrix:
        provider:
          - name: aws
            key: AWS_DEPLOY
            region: us-east-1
          - name: gcp
            key: GCP_DEPLOY
            region: us-central1
          - name: azure
            key: AZURE_DEPLOY
            region: eastus
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Get ${{ matrix.provider.name }} credentials
        run: |
          GITHUB_TOKEN=$(curl -H "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
            "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=https://github.com/myorg" | jq -r .value)
          
          voidkey mint \
            --keys ${{ matrix.provider.key }}_${{ github.event.inputs.environment | upper }} \
            --broker-url ${{ vars.VOIDKEY_BROKER_URL }} \
            --token "$GITHUB_TOKEN" \
            --output json > credentials.json
      
      - name: Deploy to ${{ matrix.provider.name }}
        run: |
          ./scripts/deploy-${{ matrix.provider.name }}.sh \
            ${{ github.event.inputs.environment }} \
            ${{ matrix.provider.region }} \
            credentials.json
```

## GitLab CI Integration

### Basic Pipeline

```yaml
# .gitlab-ci.yml
stages:
  - build
  - deploy

variables:
  VOIDKEY_BROKER_URL: "https://voidkey.company.com"

before_script:
  - apt-get update -y && apt-get install -y curl jq
  - curl -L -o voidkey https://github.com/voidkey-oss/voidkey/releases/latest/download/voidkey-linux-amd64
  - chmod +x voidkey && mv voidkey /usr/local/bin/

build:
  stage: build
  script:
    - npm ci
    - npm run build
  artifacts:
    paths:
      - dist/
    expire_in: 1 hour

deploy-staging:
  stage: deploy
  only:
    - develop
  id_tokens:
    GITLAB_OIDC_TOKEN:
      aud: https://gitlab.com/myorg
  script:
    - |
      voidkey mint \
        --keys AWS_STAGING_DEPLOY \
        --broker-url $VOIDKEY_BROKER_URL \
        --token $GITLAB_OIDC_TOKEN \
        --output dotenv > .env
    - source .env
    - aws s3 sync dist/ s3://staging-bucket/

deploy-production:
  stage: deploy
  only:
    - main
  when: manual
  id_tokens:
    GITLAB_OIDC_TOKEN:
      aud: https://gitlab.com/myorg
  script:
    - |
      voidkey mint \
        --keys AWS_PROD_DEPLOY,GCP_PROD_DEPLOY \
        --broker-url $VOIDKEY_BROKER_URL \
        --token $GITLAB_OIDC_TOKEN \
        --output json > credentials.json
    - python scripts/multi-cloud-deploy.py credentials.json
```

### GitLab with Kubernetes

```yaml
# .gitlab-ci.yml
deploy-k8s:
  stage: deploy
  image: kubectl:latest
  id_tokens:
    GITLAB_OIDC_TOKEN:
      aud: https://gitlab.com/myorg
  script:
    - |
      # Get GCP credentials for GKE access
      voidkey mint \
        --keys GCP_K8S_DEPLOY \
        --broker-url $VOIDKEY_BROKER_URL \
        --token $GITLAB_OIDC_TOKEN \
        --output json > gcp-creds.json
    
    - |
      # Authenticate with GCP
      gcloud auth activate-service-account --key-file=gcp-creds.json
      gcloud container clusters get-credentials production-cluster \
        --zone us-central1-a --project my-project
    
    - |
      # Deploy to Kubernetes
      kubectl set image deployment/myapp \
        myapp=gcr.io/my-project/myapp:$CI_COMMIT_SHA
      kubectl rollout status deployment/myapp
```

## Azure DevOps Integration

### Azure Pipelines

```yaml
# azure-pipelines.yml
trigger:
  branches:
    include:
      - main
      - develop

pool:
  vmImage: 'ubuntu-latest'

variables:
  VOIDKEY_BROKER_URL: 'https://voidkey.company.com'

jobs:
- job: Deploy
  steps:
  - checkout: self
  
  - task: AzureCLI@2
    displayName: 'Install Voidkey CLI'
    inputs:
      azureSubscription: 'service-connection'
      scriptType: 'bash'
      scriptLocation: 'inlineScript'
      inlineScript: |
        curl -L -o voidkey https://github.com/voidkey-oss/voidkey/releases/latest/download/voidkey-linux-amd64
        chmod +x voidkey
        sudo mv voidkey /usr/local/bin/
  
  - task: AzureCLI@2
    displayName: 'Get Azure credentials via Voidkey'
    inputs:
      azureSubscription: 'service-connection'
      scriptType: 'bash'
      scriptLocation: 'inlineScript'
      inlineScript: |
        # Get Azure DevOps OIDC token
        ADOS_TOKEN=$(curl -H "Authorization: Bearer $SYSTEM_ACCESSTOKEN" \
          "$SYSTEM_TEAMFOUNDATIONSERVERURI$SYSTEM_TEAMPROJECT/_apis/distributedtask/hubs/build/plans/$SYSTEM_PLANID/jobs/$SYSTEM_JOBID/oidctoken?serviceConnectionId=$SERVICE_CONNECTION_ID&api-version=7.1-preview.1" \
          | jq -r .oidcToken)
        
        # Mint Azure credentials
        voidkey mint \
          --keys AZURE_PROD_DEPLOY \
          --broker-url $(VOIDKEY_BROKER_URL) \
          --token "$ADOS_TOKEN" \
          --output env >> $GITHUB_ENV
    env:
      SYSTEM_ACCESSTOKEN: $(System.AccessToken)
  
  - task: AzureCLI@2
    displayName: 'Deploy to Azure'
    inputs:
      azureSubscription: 'service-connection'
      scriptType: 'bash'
      scriptLocation: 'inlineScript'
      inlineScript: |
        source .env
        az storage blob upload-batch \
          --source ./dist \
          --destination '$web' \
          --account-name mystorageaccount
```

## Jenkins Integration

### Declarative Pipeline

```groovy
// Jenkinsfile
pipeline {
    agent any
    
    environment {
        VOIDKEY_BROKER_URL = 'https://voidkey.company.com'
        VOIDKEY_CLI_VERSION = 'latest'
    }
    
    stages {
        stage('Setup') {
            steps {
                script {
                    // Install Voidkey CLI
                    sh '''
                        curl -L -o voidkey https://github.com/voidkey-oss/voidkey/releases/latest/download/voidkey-linux-amd64
                        chmod +x voidkey
                        sudo mv voidkey /usr/local/bin/
                    '''
                }
            }
        }
        
        stage('Get Credentials') {
            steps {
                script {
                    // Get Jenkins OIDC token (requires OIDC plugin)
                    def token = sh(
                        script: 'echo $OIDC_TOKEN',
                        returnStdout: true
                    ).trim()
                    
                    // Determine keys based on branch
                    def keys = env.BRANCH_NAME == 'main' ? 'AWS_PROD_DEPLOY' : 'AWS_STAGING_DEPLOY'
                    
                    // Mint credentials
                    sh """
                        voidkey mint \\
                            --keys ${keys} \\
                            --broker-url ${VOIDKEY_BROKER_URL} \\
                            --token "${token}" \\
                            --output dotenv > .env.credentials
                    """
                    
                    // Load credentials into environment
                    def props = readProperties file: '.env.credentials'
                    props.each { key, value ->
                        env[key] = value
                    }
                }
            }
        }
        
        stage('Deploy') {
            steps {
                script {
                    if (env.BRANCH_NAME == 'main') {
                        sh './scripts/deploy-production.sh'
                    } else {
                        sh './scripts/deploy-staging.sh'
                    }
                }
            }
        }
    }
    
    post {
        always {
            // Clean up credentials
            sh 'rm -f .env.credentials'
        }
    }
}
```

### Scripted Pipeline with Parallel Deployment

```groovy
// Jenkinsfile
node {
    def brokerUrl = 'https://voidkey.company.com'
    
    stage('Setup') {
        checkout scm
        
        sh '''
            curl -L -o voidkey https://github.com/voidkey-oss/voidkey/releases/latest/download/voidkey-linux-amd64
            chmod +x voidkey
            sudo mv voidkey /usr/local/bin/
        '''
    }
    
    stage('Parallel Deploy') {
        parallel(
            'AWS': {
                script {
                    def token = sh(script: 'echo $OIDC_TOKEN', returnStdout: true).trim()
                    
                    sh """
                        voidkey mint \\
                            --keys AWS_DEPLOY \\
                            --broker-url ${brokerUrl} \\
                            --token "${token}" \\
                            --output env > aws.env
                    """
                    
                    sh '''
                        source aws.env
                        aws s3 sync dist/ s3://my-bucket/
                    '''
                }
            },
            'GCP': {
                script {
                    def token = sh(script: 'echo $OIDC_TOKEN', returnStdout: true).trim()
                    
                    sh """
                        voidkey mint \\
                            --keys GCP_DEPLOY \\
                            --broker-url ${brokerUrl} \\
                            --token "${token}" \\
                            --output json > gcp-creds.json
                    """
                    
                    sh '''
                        gcloud auth activate-service-account --key-file=gcp-creds.json
                        gsutil -m rsync -r -d dist/ gs://my-gcp-bucket/
                    '''
                }
            }
        )
    }
}
```

## CircleCI Integration

### Basic Configuration

```yaml
# .circleci/config.yml
version: 2.1

executors:
  default:
    docker:
      - image: cimg/node:18.17

jobs:
  deploy:
    executor: default
    steps:
      - checkout
      
      - run:
          name: Install Voidkey CLI
          command: |
            curl -L -o voidkey https://github.com/voidkey-oss/voidkey/releases/latest/download/voidkey-linux-amd64
            chmod +x voidkey
            sudo mv voidkey /usr/local/bin/
      
      - run:
          name: Get temporary credentials
          command: |
            # Get CircleCI OIDC token
            CIRCLECI_TOKEN=$(curl -H "Circle-Token: $CIRCLE_TOKEN" \
              "https://circleci.com/api/v2/project/$CIRCLE_PROJECT_USERNAME/$CIRCLE_PROJECT_REPONAME/oidc-token" \
              | jq -r .token)
            
            # Mint AWS credentials
            voidkey mint \
              --keys AWS_DEPLOY \
              --broker-url $VOIDKEY_BROKER_URL \
              --token "$CIRCLECI_TOKEN" \
              --output dotenv > .env.credentials
            
            cat .env.credentials >> $BASH_ENV
      
      - run:
          name: Deploy to AWS
          command: |
            source $BASH_ENV
            aws s3 sync dist/ s3://my-production-bucket/

workflows:
  deploy:
    jobs:
      - deploy:
          filters:
            branches:
              only: main
          context: production
```

## Custom CI/CD Integration

### Generic OIDC Integration

```bash
#!/bin/bash
# scripts/generic-deploy.sh

set -e

# Configuration
VOIDKEY_BROKER_URL="${VOIDKEY_BROKER_URL:-https://voidkey.company.com}"
ENVIRONMENT="${CI_ENVIRONMENT:-staging}"

# Function to get OIDC token (implement based on your CI/CD platform)
get_oidc_token() {
    case "$CI_PLATFORM" in
        "github")
            curl -H "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" \
                "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=https://github.com/myorg" | jq -r .value
            ;;
        "gitlab")
            echo "$CI_JOB_JWT_V2"
            ;;
        "jenkins")
            echo "$OIDC_TOKEN"
            ;;
        *)
            echo "Unsupported CI platform: $CI_PLATFORM" >&2
            exit 1
            ;;
    esac
}

# Get deployment keys based on environment
get_deployment_keys() {
    case "$ENVIRONMENT" in
        "production")
            echo "AWS_PROD_DEPLOY,GCP_PROD_DEPLOY"
            ;;
        "staging")
            echo "AWS_STAGING_DEPLOY"
            ;;
        "preview")
            echo "AWS_PREVIEW_DEPLOY"
            ;;
        *)
            echo "Unknown environment: $ENVIRONMENT" >&2
            exit 1
            ;;
    esac
}

# Main deployment logic
main() {
    echo "Starting deployment to $ENVIRONMENT..."
    
    # Get OIDC token
    echo "Getting OIDC token..."
    OIDC_TOKEN=$(get_oidc_token)
    
    if [ -z "$OIDC_TOKEN" ] || [ "$OIDC_TOKEN" = "null" ]; then
        echo "Failed to get OIDC token" >&2
        exit 1
    fi
    
    # Get deployment keys
    KEYS=$(get_deployment_keys)
    echo "Using keys: $KEYS"
    
    # Mint credentials
    echo "Minting credentials via Voidkey..."
    voidkey mint \
        --keys "$KEYS" \
        --broker-url "$VOIDKEY_BROKER_URL" \
        --token "$OIDC_TOKEN" \
        --output json > credentials.json
    
    # Verify credentials were obtained
    if [ ! -s credentials.json ]; then
        echo "Failed to obtain credentials" >&2
        exit 1
    fi
    
    echo "Credentials obtained successfully"
    
    # Deploy based on available credentials
    if jq -e '.AWS_PROD_DEPLOY' credentials.json >/dev/null; then
        echo "Deploying to AWS Production..."
        deploy_to_aws_prod
    fi
    
    if jq -e '.AWS_STAGING_DEPLOY' credentials.json >/dev/null; then
        echo "Deploying to AWS Staging..."
        deploy_to_aws_staging
    fi
    
    if jq -e '.GCP_PROD_DEPLOY' credentials.json >/dev/null; then
        echo "Deploying to GCP Production..."
        deploy_to_gcp_prod
    fi
    
    echo "Deployment completed successfully!"
}

# AWS Production deployment
deploy_to_aws_prod() {
    # Extract AWS credentials
    export AWS_ACCESS_KEY_ID=$(jq -r '.AWS_PROD_DEPLOY.AWS_ACCESS_KEY_ID' credentials.json)
    export AWS_SECRET_ACCESS_KEY=$(jq -r '.AWS_PROD_DEPLOY.AWS_SECRET_ACCESS_KEY' credentials.json)
    export AWS_SESSION_TOKEN=$(jq -r '.AWS_PROD_DEPLOY.AWS_SESSION_TOKEN' credentials.json)
    
    # Deploy
    aws s3 sync dist/ s3://production-bucket/
    aws cloudfront create-invalidation --distribution-id E1234567890 --paths "/*"
}

# AWS Staging deployment
deploy_to_aws_staging() {
    # Extract AWS credentials
    export AWS_ACCESS_KEY_ID=$(jq -r '.AWS_STAGING_DEPLOY.AWS_ACCESS_KEY_ID' credentials.json)
    export AWS_SECRET_ACCESS_KEY=$(jq -r '.AWS_STAGING_DEPLOY.AWS_SECRET_ACCESS_KEY' credentials.json)
    export AWS_SESSION_TOKEN=$(jq -r '.AWS_STAGING_DEPLOY.AWS_SESSION_TOKEN' credentials.json)
    
    # Deploy
    aws s3 sync dist/ s3://staging-bucket/
}

# GCP Production deployment
deploy_to_gcp_prod() {
    # Extract GCP service account key
    jq -r '.GCP_PROD_DEPLOY.SERVICE_ACCOUNT_KEY' credentials.json > gcp-key.json
    
    # Authenticate
    gcloud auth activate-service-account --key-file=gcp-key.json
    
    # Deploy
    gsutil -m rsync -r -d dist/ gs://production-gcp-bucket/
}

# Cleanup function
cleanup() {
    echo "Cleaning up..."
    rm -f credentials.json gcp-key.json
    unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
}

# Set trap for cleanup
trap cleanup EXIT

# Run main function
main "$@"
```

## Best Practices

### Security Considerations

1. **Token Handling**
   ```bash
   # Never log tokens
   set +x  # Disable command echo
   OIDC_TOKEN=$(get_token)
   set -x  # Re-enable if needed
   
   # Use secure temporary files
   CREDS_FILE=$(mktemp)
   trap "rm -f $CREDS_FILE" EXIT
   ```

2. **Credential Cleanup**
   ```bash
   # Always clean up credentials
   cleanup_credentials() {
       rm -f .env.credentials credentials.json
       unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN
   }
   trap cleanup_credentials EXIT
   ```

3. **Error Handling**
   ```bash
   # Fail fast on errors
   set -euo pipefail
   
   # Check for required tools
   command -v voidkey >/dev/null 2>&1 || {
       echo "voidkey CLI not found" >&2
       exit 1
   }
   ```

### Performance Optimization

1. **Credential Caching**
   ```bash
   # Cache credentials for job duration
   if [ ! -f /tmp/voidkey-cache ]; then
       voidkey mint --keys "$KEYS" --output json > /tmp/voidkey-cache
   fi
   ```

2. **Parallel Operations**
   ```bash
   # Deploy to multiple environments in parallel
   deploy_aws &
   deploy_gcp &
   wait  # Wait for all background jobs
   ```

### Monitoring and Logging

1. **Audit Logging**
   ```bash
   # Log deployment events
   echo "$(date): Deploying $KEYS to $ENVIRONMENT" >> /var/log/deployments.log
   ```

2. **Metrics Collection**
   ```bash
   # Send deployment metrics
   curl -X POST https://metrics.company.com/deployments \
       -d "environment=$ENVIRONMENT&status=success&duration=$DURATION"
   ```

## Troubleshooting

### Common Issues

1. **Token Validation Failures**
   ```bash
   # Debug token claims
   voidkey debug-token --token "$OIDC_TOKEN"
   ```

2. **Network Connectivity**
   ```bash
   # Test broker connectivity
   curl -f "$VOIDKEY_BROKER_URL/health" || {
       echo "Cannot reach Voidkey broker" >&2
       exit 1
   }
   ```

3. **Permission Issues**
   ```bash
   # Check available keys
   voidkey list-keys --token "$OIDC_TOKEN" --broker-url "$VOIDKEY_BROKER_URL"
   ```

## Next Steps

- [CLI Reference](/cli/commands/) - Complete CLI command reference
- [Configuration Guide](/configuration/guide/) - Configure identity mappings
- [API Reference](/api/rest/) - Direct API integration
- [Security Model](/architecture/security/) - Security considerations for CI/CD