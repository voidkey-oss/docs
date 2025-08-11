---
title: Docker Deployment
description: Deploy Voidkey using Docker and Docker Compose
---

This guide covers deploying Voidkey using Docker containers for production use.

## Quick Start

Deploy Voidkey with Docker Compose:

```bash
# Clone the repository
git clone https://github.com/voidkey-oss/voidkey.git
cd voidkey

# Copy and customize configuration
cp docker/docker-compose.prod.yml docker-compose.yml
cp docker/config.example.yaml config.yaml

# Edit configuration for your environment
vim config.yaml

# Start services
docker-compose up -d
```

## Container Images

### Official Images

Voidkey provides official Docker images:

```bash
# Broker server
docker pull voidkey/broker:latest
docker pull voidkey/broker:0.8.0

# CLI (multi-arch)
docker pull voidkey/cli:latest
docker pull voidkey/cli:0.8.0
```

### Image Variants

| Tag | Description | Size |
|-----|-------------|------|
| `latest` | Latest stable release | ~100MB |
| `0.8.0` | Specific version | ~100MB |
| `alpine` | Alpine-based (smaller) | ~80MB |
| `debug` | With debugging tools | ~150MB |

## Docker Compose Setup

### Production Configuration

```yaml
# docker-compose.yml
version: '3.8'

services:
  voidkey-broker:
    image: voidkey/broker:latest
    ports:
      - "3000:3000"
    volumes:
      - ./config.yaml:/app/config/config.yaml:ro
      - ./logs:/app/logs
    environment:
      - NODE_ENV=production
      - LOG_LEVEL=info
      - CONFIG_PATH=/app/config/config.yaml
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 30s
    
    # Security settings
    user: "1001:1001"
    read_only: true
    tmpfs:
      - /tmp
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    
    # Resource limits
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '0.5'
        reservations:
          memory: 256M
          cpus: '0.25'

  # Optional: Reverse proxy
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/ssl/certs:ro
    depends_on:
      - voidkey-broker
    restart: unless-stopped

volumes:
  logs:
    driver: local
```

### Development Configuration

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  voidkey-broker:
    build:
      context: .
      dockerfile: docker/Dockerfile.dev
    ports:
      - "3000:3000"
      - "9229:9229"  # Debug port
    volumes:
      - .:/app
      - /app/node_modules
      - ./config/dev-config.yaml:/app/config/config.yaml
    environment:
      - NODE_ENV=development
      - LOG_LEVEL=debug
    command: npm run start:debug

  # Development dependencies
  keycloak:
    image: quay.io/keycloak/keycloak:latest
    environment:
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin
    ports:
      - "8080:8080"
    command: start-dev

  minio:
    image: minio/minio:latest
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    command: server /data --console-address ":9001"
```

## Building Custom Images

### Dockerfile

```dockerfile
# docker/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY broker-core/package*.json ./broker-core/
COPY broker-server/package*.json ./broker-server/

# Install dependencies
RUN cd broker-core && npm ci --only=production
RUN cd broker-server && npm ci --only=production

# Copy source
COPY broker-core/ ./broker-core/
COPY broker-server/ ./broker-server/

# Build applications
RUN cd broker-core && npm run build
RUN cd broker-server && npm run build

# Production image
FROM node:18-alpine AS production

# Create non-root user
RUN addgroup -g 1001 -S voidkey && \
    adduser -S voidkey -u 1001 -G voidkey

WORKDIR /app

# Copy built applications
COPY --from=builder --chown=voidkey:voidkey /app/broker-core/dist ./broker-core/dist
COPY --from=builder --chown=voidkey:voidkey /app/broker-core/package*.json ./broker-core/
COPY --from=builder --chown=voidkey:voidkey /app/broker-server/dist ./broker-server/dist
COPY --from=builder --chown=voidkey:voidkey /app/broker-server/package*.json ./broker-server/

# Install production dependencies
RUN cd broker-core && npm ci --only=production && npm cache clean --force
RUN cd broker-server && npm ci --only=production && npm cache clean --force

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Security settings
USER voidkey
EXPOSE 3000

# Start command
CMD ["node", "broker-server/dist/main.js"]
```

### Multi-stage Build

```dockerfile
# Optimized multi-stage build
FROM node:18-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build

FROM node:18-alpine AS runner
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S voidkey -u 1001

COPY --from=deps --chown=voidkey:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=voidkey:nodejs /app/dist ./dist
COPY --from=builder --chown=voidkey:nodejs /app/package.json ./package.json

USER voidkey
EXPOSE 3000
CMD ["node", "dist/main.js"]
```

## Configuration Management

### Environment Variables

```bash
# Core configuration
NODE_ENV=production
LOG_LEVEL=info
PORT=3000

# Configuration file
CONFIG_PATH=/app/config/config.yaml

# Secrets (use Docker secrets or external secret management)
BROKER_CLIENT_SECRET_FILE=/run/secrets/broker_secret
AWS_EXTERNAL_ID_FILE=/run/secrets/aws_external_id
```

### Docker Secrets

```yaml
# docker-compose.yml with secrets
version: '3.8'

services:
  voidkey-broker:
    image: voidkey/broker:latest
    secrets:
      - broker_secret
      - aws_external_id
    environment:
      - BROKER_CLIENT_SECRET_FILE=/run/secrets/broker_secret
      - AWS_EXTERNAL_ID_FILE=/run/secrets/aws_external_id
    
secrets:
  broker_secret:
    file: ./secrets/broker_secret.txt
  aws_external_id:
    file: ./secrets/aws_external_id.txt
```

### Configuration Volume

```yaml
services:
  voidkey-broker:
    volumes:
      - type: bind
        source: ./config
        target: /app/config
        read_only: true
      - type: volume
        source: logs
        target: /app/logs
```

## Reverse Proxy Setup

### Nginx Configuration

```nginx
# nginx.conf
events {
    worker_connections 1024;
}

http {
    upstream voidkey {
        server voidkey-broker:3000;
    }

    server {
        listen 80;
        server_name voidkey.example.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name voidkey.example.com;

        ssl_certificate /etc/ssl/certs/voidkey.crt;
        ssl_certificate_key /etc/ssl/certs/voidkey.key;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
        ssl_prefer_server_ciphers off;

        # Security headers
        add_header Strict-Transport-Security "max-age=63072000" always;
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;

        location / {
            proxy_pass http://voidkey;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Timeouts
            proxy_connect_timeout 5s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }

        location /health {
            proxy_pass http://voidkey;
            access_log off;
        }
    }
}
```

### Traefik Configuration

```yaml
# docker-compose.yml with Traefik
version: '3.8'

services:
  traefik:
    image: traefik:v2.9
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--certificatesresolvers.letsencrypt.acme.email=admin@example.com"
      - "--certificatesresolvers.letsencrypt.acme.storage=/acme.json"
      - "--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web"
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./acme.json:/acme.json

  voidkey-broker:
    image: voidkey/broker:latest
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.voidkey.rule=Host(`voidkey.example.com`)"
      - "traefik.http.routers.voidkey.entrypoints=websecure"
      - "traefik.http.routers.voidkey.tls.certresolver=letsencrypt"
      - "traefik.http.services.voidkey.loadbalancer.server.port=3000"
```

## High Availability Setup

### Multiple Instances

```yaml
# docker-compose.ha.yml
version: '3.8'

services:
  voidkey-broker-1:
    image: voidkey/broker:latest
    volumes:
      - ./config.yaml:/app/config/config.yaml:ro
    environment:
      - INSTANCE_ID=broker-1

  voidkey-broker-2:
    image: voidkey/broker:latest
    volumes:
      - ./config.yaml:/app/config/config.yaml:ro
    environment:
      - INSTANCE_ID=broker-2

  voidkey-broker-3:
    image: voidkey/broker:latest
    volumes:
      - ./config.yaml:/app/config/config.yaml:ro
    environment:
      - INSTANCE_ID=broker-3

  load-balancer:
    image: nginx:alpine
    ports:
      - "3000:80"
    volumes:
      - ./nginx-lb.conf:/etc/nginx/nginx.conf:ro
    depends_on:
      - voidkey-broker-1
      - voidkey-broker-2
      - voidkey-broker-3
```

### Load Balancer Configuration

```nginx
# nginx-lb.conf
upstream voidkey_cluster {
    least_conn;
    server voidkey-broker-1:3000 max_fails=3 fail_timeout=30s;
    server voidkey-broker-2:3000 max_fails=3 fail_timeout=30s;
    server voidkey-broker-3:3000 max_fails=3 fail_timeout=30s;
}

server {
    listen 80;
    
    location / {
        proxy_pass http://voidkey_cluster;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
    }
    
    location /health {
        proxy_pass http://voidkey_cluster;
        proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
    }
}
```

## Monitoring and Logging

### Logging Configuration

```yaml
services:
  voidkey-broker:
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
    
  # Centralized logging
  fluentd:
    image: fluent/fluentd:v1.12-debian
    volumes:
      - ./fluentd.conf:/fluentd/etc/fluent.conf
      - /var/log:/var/log
    ports:
      - "24224:24224"
```

### Prometheus Metrics

```yaml
services:
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
  
  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
    volumes:
      - grafana-data:/var/lib/grafana

volumes:
  grafana-data:
```

## Security Hardening

### Container Security

```yaml
services:
  voidkey-broker:
    # Run as non-root user
    user: "1001:1001"
    
    # Read-only filesystem
    read_only: true
    tmpfs:
      - /tmp:size=100M
      - /app/logs:size=500M
    
    # Drop capabilities
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
    
    # Security options
    security_opt:
      - no-new-privileges:true
      - apparmor:docker-default
    
    # Resource limits
    mem_limit: 512m
    mem_reservation: 256m
    cpus: 0.5
```

### Network Security

```yaml
networks:
  frontend:
    driver: bridge
  backend:
    driver: bridge
    internal: true

services:
  nginx:
    networks:
      - frontend
      
  voidkey-broker:
    networks:
      - frontend
      - backend
    
  database:
    networks:
      - backend
```

## Backup and Recovery

### Configuration Backup

```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/voidkey/$DATE"

mkdir -p "$BACKUP_DIR"

# Backup configuration
cp config.yaml "$BACKUP_DIR/"
cp docker-compose.yml "$BACKUP_DIR/"

# Backup secrets
cp -r secrets/ "$BACKUP_DIR/"

# Backup logs
tar -czf "$BACKUP_DIR/logs.tar.gz" logs/

echo "Backup completed: $BACKUP_DIR"
```

### Disaster Recovery

```bash
#!/bin/bash
# restore.sh
BACKUP_DIR=$1

if [ -z "$BACKUP_DIR" ]; then
  echo "Usage: $0 <backup_directory>"
  exit 1
fi

# Stop services
docker-compose down

# Restore configuration
cp "$BACKUP_DIR/config.yaml" ./
cp "$BACKUP_DIR/docker-compose.yml" ./

# Restore secrets
cp -r "$BACKUP_DIR/secrets/" ./

# Start services
docker-compose up -d

echo "Restore completed from: $BACKUP_DIR"
```

## Troubleshooting

### Common Issues

**Container won't start:**
```bash
# Check logs
docker-compose logs voidkey-broker

# Check configuration
docker-compose config

# Validate config file
docker run --rm -v $(pwd)/config.yaml:/config.yaml voidkey/broker:latest node -e "
  const yaml = require('yaml');
  const fs = require('fs');
  try {
    yaml.parse(fs.readFileSync('/config.yaml', 'utf8'));
    console.log('Config is valid');
  } catch (e) {
    console.error('Config error:', e.message);
    process.exit(1);
  }
"
```

**Health check failing:**
```bash
# Test health endpoint
curl -f http://localhost:3000/health

# Check container health
docker inspect --format='{{.State.Health.Status}}' voidkey_voidkey-broker_1
```

**Permission issues:**
```bash
# Fix ownership
sudo chown -R 1001:1001 config/ logs/

# Check SELinux contexts
ls -Z config/
```

## Next Steps

- [Kubernetes Deployment](/deployment/kubernetes/) - Container orchestration
- [Production Deployment](/deployment/production/) - Production best practices
- [Monitoring Guide](/monitoring/setup/) - Set up monitoring
- [Security Guide](/architecture/security/) - Security considerations