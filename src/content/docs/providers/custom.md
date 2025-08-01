---
title: Custom Providers
description: Build custom identity and access providers for Voidkey
---

This guide shows how to create custom providers to extend Voidkey's functionality for unsupported identity providers and cloud services.

## Provider Architecture

Voidkey uses a plugin architecture with well-defined interfaces for both identity and access providers.

### Interface Overview

```typescript
// Identity Provider Interface
interface IdpProvider {
  name: string;
  issuer: string;
  audience?: string | string[];
  
  validateToken(token: string): Promise<TokenClaims>;
  getPublicKeys(): Promise<JWKSet>;
}

// Access Provider Interface
interface AccessProvider {
  name: string;
  type: string;
  
  authenticate(brokerToken: string): Promise<void>;
  mintCredentials(keyConfig: any, subject: string): Promise<Credentials>;
}
```

## Custom Identity Provider

Create a custom identity provider for unsupported OIDC systems.

### Implementation

```typescript
// src/providers/idp/custom-idp.provider.ts
import { IdpProvider, TokenClaims, JWKSet } from '@voidkey/broker-core';
import { Injectable } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import * as jwksClient from 'jwks-rsa';

export interface CustomIdpConfig {
  name: string;
  issuer: string;
  audience?: string | string[];
  jwksUri?: string;
  algorithms?: string[];
  clockTolerance?: number;
}

@Injectable()
export class CustomIdpProvider implements IdpProvider {
  name: string;
  issuer: string;
  audience?: string | string[];
  
  private jwksClient: jwksClient.JwksClient;

  constructor(private config: CustomIdpConfig) {
    this.name = config.name;
    this.issuer = config.issuer;
    this.audience = config.audience;
    
    // Initialize JWKS client
    const jwksUri = config.jwksUri || `${config.issuer}/.well-known/jwks.json`;
    this.jwksClient = jwksClient({
      jwksUri,
      cache: true,
      cacheMaxAge: 600000, // 10 minutes
      rateLimit: true,
      jwksRequestsPerMinute: 10
    });
  }

  async validateToken(token: string): Promise<TokenClaims> {
    try {
      // Decode token header to get key ID
      const decoded = jwt.decode(token, { complete: true });
      if (!decoded || typeof decoded === 'string') {
        throw new Error('Invalid token format');
      }

      // Get signing key
      const signingKey = await this.getSigningKey(decoded.header.kid);
      
      // Verify token
      const payload = jwt.verify(token, signingKey, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: this.config.algorithms || ['RS256'],
        clockTolerance: this.config.clockTolerance || 60
      }) as any;

      // Extract standard claims
      return {
        issuer: payload.iss,
        subject: payload.sub,
        audience: Array.isArray(payload.aud) ? payload.aud : [payload.aud],
        expiresAt: new Date(payload.exp * 1000),
        issuedAt: new Date(payload.iat * 1000),
        notBefore: payload.nbf ? new Date(payload.nbf * 1000) : undefined,
        customClaims: this.extractCustomClaims(payload)
      };
    } catch (error) {
      throw new Error(`Token validation failed: ${error.message}`);
    }
  }

  async getPublicKeys(): Promise<JWKSet> {
    const jwksUri = this.config.jwksUri || `${this.issuer}/.well-known/jwks.json`;
    
    const response = await fetch(jwksUri, {
      timeout: 10000,
      headers: {
        'User-Agent': 'voidkey-broker/1.0'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch JWKS: ${response.statusText}`);
    }

    return response.json();
  }

  private async getSigningKey(kid?: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.jwksClient.getSigningKey(kid, (err, key) => {
        if (err) {
          reject(new Error(`Failed to get signing key: ${err.message}`));
          return;
        }
        
        const signingKey = key.getPublicKey();
        resolve(signingKey);
      });
    });
  }

  private extractCustomClaims(payload: any): Record<string, any> {
    const standardClaims = ['iss', 'sub', 'aud', 'exp', 'iat', 'nbf', 'jti'];
    const customClaims: Record<string, any> = {};

    for (const [key, value] of Object.entries(payload)) {
      if (!standardClaims.includes(key)) {
        customClaims[key] = value;
      }
    }

    return customClaims;
  }
}
```

### Registration

```typescript
// src/providers/providers.module.ts
import { Module } from '@nestjs/common';
import { CustomIdpProvider } from './idp/custom-idp.provider';

@Module({
  providers: [
    {
      provide: 'CUSTOM_IDP',
      useFactory: (configService: ConfigService) => {
        const config = configService.get('customIdp');
        return new CustomIdpProvider(config);
      },
      inject: [ConfigService]
    }
  ],
  exports: ['CUSTOM_IDP']
})
export class ProvidersModule {}
```

### Configuration

```yaml
# config.yaml
customIdp:
  name: "custom-corp-idp"
  issuer: "https://auth.corp.example.com"
  audience: "voidkey-broker"
  jwksUri: "https://auth.corp.example.com/.well-known/jwks.json"
  algorithms: ["RS256", "ES256"]
  clockTolerance: 60

clientIdps:
  - name: "custom-corp-idp"
    issuer: "https://auth.corp.example.com"
    audience: "voidkey-broker"
```

### Testing

```typescript
// src/providers/idp/__tests__/custom-idp.provider.spec.ts
import { CustomIdpProvider } from '../custom-idp.provider';
import { Test } from '@nestjs/testing';

describe('CustomIdpProvider', () => {
  let provider: CustomIdpProvider;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        {
          provide: CustomIdpProvider,
          useValue: new CustomIdpProvider({
            name: 'test-idp',
            issuer: 'https://test.example.com',
            audience: 'test-audience'
          })
        }
      ]
    }).compile();

    provider = module.get<CustomIdpProvider>(CustomIdpProvider);
  });

  it('should validate a valid token', async () => {
    // Mock JWT and JWKS
    const validToken = 'eyJhbGciOiJSUzI1NiIs...';
    
    // Test token validation
    const result = await provider.validateToken(validToken);
    
    expect(result.issuer).toBe('https://test.example.com');
    expect(result.subject).toBe('test-subject');
  });

  it('should reject an invalid token', async () => {
    const invalidToken = 'invalid.token.here';
    
    await expect(provider.validateToken(invalidToken))
      .rejects.toThrow('Token validation failed');
  });
});
```

## Custom Access Provider

Create a custom access provider for unsupported cloud services.

### Implementation

```typescript
// src/providers/access/custom-access.provider.ts
import { AccessProvider, Credentials } from '@voidkey/broker-core';
import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

export interface CustomAccessConfig {
  name: string;
  type: string;
  endpoint: string;
  clientId: string;
  clientSecret: string;
  timeout?: number;
  retries?: number;
}

export interface CustomKeyConfig {
  duration: number;
  permissions: string[];
  scopes?: string[];
  customField?: string;
}

@Injectable()
export class CustomAccessProvider implements AccessProvider {
  name: string;
  type: string;
  private readonly logger = new Logger(CustomAccessProvider.name);
  private authToken?: string;
  private tokenExpiresAt?: Date;

  constructor(
    private config: CustomAccessConfig,
    private httpService: HttpService
  ) {
    this.name = config.name;
    this.type = config.type || 'custom-service';
  }

  async authenticate(brokerToken: string): Promise<void> {
    // Check if we have a valid cached token
    if (this.authToken && this.tokenExpiresAt && this.tokenExpiresAt > new Date()) {
      return;
    }

    this.logger.debug(`Authenticating with ${this.config.endpoint}`);

    try {
      const response = await firstValueFrom(
        this.httpService.post(`${this.config.endpoint}/auth`, {
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          broker_token: brokerToken,
          grant_type: 'broker_credentials'
        }, {
          timeout: this.config.timeout || 30000,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'voidkey-broker/1.0'
          }
        })
      );

      const authData = response.data;
      this.authToken = authData.access_token;
      
      // Calculate expiration time (default to 1 hour if not provided)
      const expiresIn = authData.expires_in || 3600;
      this.tokenExpiresAt = new Date(Date.now() + expiresIn * 1000);

      this.logger.debug(`Authentication successful, token expires at ${this.tokenExpiresAt}`);
    } catch (error) {
      this.logger.error(`Authentication failed: ${error.message}`);
      throw new Error(`Failed to authenticate with ${this.name}: ${error.message}`);
    }
  }

  async mintCredentials(keyConfig: CustomKeyConfig, subject: string): Promise<Credentials> {
    // Ensure we're authenticated
    if (!this.authToken) {
      throw new Error('Provider not authenticated');
    }

    const startTime = Date.now();
    this.logger.debug(`Minting credentials for subject: ${subject}`);

    try {
      const response = await this.withRetry(async () => {
        return firstValueFrom(
          this.httpService.post(`${this.config.endpoint}/credentials`, {
            subject,
            duration: keyConfig.duration,
            permissions: keyConfig.permissions,
            scopes: keyConfig.scopes || [],
            custom_field: keyConfig.customField
          }, {
            timeout: this.config.timeout || 30000,
            headers: {
              'Authorization': `Bearer ${this.authToken}`,
              'Content-Type': 'application/json'
            }
          })
        );
      });

      const credData = response.data;
      const latency = Date.now() - startTime;
      
      this.logger.debug(`Credentials minted successfully in ${latency}ms`);

      // Return standardized credential format
      return {
        AccessKeyId: credData.access_key,
        SecretAccessKey: credData.secret_key,
        SessionToken: credData.session_token,
        Expiration: new Date(credData.expires_at),
        
        // Provider-specific fields
        CustomServiceUrl: credData.service_url,
        CustomRegion: credData.region,
        CustomTenantId: credData.tenant_id
      };
    } catch (error) {
      this.logger.error(`Failed to mint credentials: ${error.message}`);
      
      if (error.response?.status === 401) {
        // Token expired, clear cached auth
        this.authToken = undefined;
        this.tokenExpiresAt = undefined;
        throw new Error('Authentication token expired');
      }
      
      throw new Error(`Failed to mint credentials: ${error.message}`);
    }
  }

  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    const maxRetries = this.config.retries || 3;
    let lastError: Error;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (this.isRetryableError(error) && attempt < maxRetries) {
          const delay = Math.pow(2, attempt) * 1000; // Exponential backoff
          this.logger.warn(`Attempt ${attempt} failed, retrying in ${delay}ms: ${error.message}`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        
        throw error;
      }
    }

    throw lastError;
  }

  private isRetryableError(error: any): boolean {
    // Retry on network errors and 5xx status codes
    return !error.response || 
           error.code === 'ECONNRESET' ||
           error.code === 'ETIMEDOUT' ||
           (error.response.status >= 500 && error.response.status <= 599);
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.config.endpoint}/health`, {
          timeout: 5000
        })
      );
      return response.status === 200;
    } catch (error) {
      this.logger.warn(`Health check failed: ${error.message}`);
      return false;
    }
  }
}
```

### Configuration

```yaml
# config.yaml
customAccess:
  name: "custom-cloud"
  type: "custom-service"
  endpoint: "https://api.custom-cloud.com"
  clientId: "voidkey-client"
  clientSecret: "${CUSTOM_CLOUD_SECRET}"
  timeout: 30000
  retries: 3

accessProviders:
  - name: "custom-cloud"
    type: "custom-service"
    endpoint: "https://api.custom-cloud.com"
    clientId: "voidkey-client"
    clientSecret: "${CUSTOM_CLOUD_SECRET}"

clientIdentities:
  - subject: "repo:myorg/myapp:ref:refs/heads/main"
    idp: "github-actions"
    keys:
      CUSTOM_ACCESS:
        provider: "custom-cloud"
        duration: 3600
        permissions:
          - "read:data"
          - "write:logs"
        scopes:
          - "api:access"
        customField: "special-value"
        outputs:
          CUSTOM_ACCESS_KEY: "AccessKeyId"
          CUSTOM_SECRET_KEY: "SecretAccessKey"
          CUSTOM_SESSION_TOKEN: "SessionToken"
          CUSTOM_SERVICE_URL: "CustomServiceUrl"
          CUSTOM_REGION: "CustomRegion"
```

### Testing

```typescript
// src/providers/access/__tests__/custom-access.provider.spec.ts
import { CustomAccessProvider } from '../custom-access.provider';
import { HttpService } from '@nestjs/axios';
import { Test } from '@nestjs/testing';
import { of } from 'rxjs';

describe('CustomAccessProvider', () => {
  let provider: CustomAccessProvider;
  let httpService: HttpService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        CustomAccessProvider,
        {
          provide: HttpService,
          useValue: {
            post: jest.fn(),
            get: jest.fn()
          }
        }
      ]
    }).compile();

    provider = module.get<CustomAccessProvider>(CustomAccessProvider);
    httpService = module.get<HttpService>(HttpService);
  });

  it('should authenticate successfully', async () => {
    const mockResponse = {
      data: {
        access_token: 'test-token',
        expires_in: 3600
      }
    };

    jest.spyOn(httpService, 'post').mockReturnValue(of(mockResponse) as any);

    await provider.authenticate('broker-token');

    expect(httpService.post).toHaveBeenCalledWith(
      expect.stringContaining('/auth'),
      expect.objectContaining({
        client_id: expect.any(String),
        broker_token: 'broker-token'
      }),
      expect.any(Object)
    );
  });

  it('should mint credentials successfully', async () => {
    // Mock authentication
    const authResponse = {
      data: { access_token: 'test-token', expires_in: 3600 }
    };
    jest.spyOn(httpService, 'post').mockReturnValueOnce(of(authResponse) as any);
    
    await provider.authenticate('broker-token');

    // Mock credential minting
    const credResponse = {
      data: {
        access_key: 'test-access-key',
        secret_key: 'test-secret-key',
        session_token: 'test-session-token',
        expires_at: '2024-01-15T11:00:00Z',
        service_url: 'https://api.example.com',
        region: 'us-east-1'
      }
    };
    jest.spyOn(httpService, 'post').mockReturnValueOnce(of(credResponse) as any);

    const keyConfig = {
      duration: 3600,
      permissions: ['read:data'],
      scopes: ['api:access']
    };

    const result = await provider.mintCredentials(keyConfig, 'test-subject');

    expect(result.AccessKeyId).toBe('test-access-key');
    expect(result.SecretAccessKey).toBe('test-secret-key');
    expect(result.SessionToken).toBe('test-session-token');
  });
});
```

## Advanced Features

### Caching

Implement intelligent caching for improved performance:

```typescript
interface CacheEntry<T> {
  data: T;
  expiresAt: Date;
}

class ProviderCache {
  private cache = new Map<string, CacheEntry<any>>();

  set<T>(key: string, data: T, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      expiresAt: new Date(Date.now() + ttlSeconds * 1000)
    });
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry || entry.expiresAt <= new Date()) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  clear(): void {
    this.cache.clear();
  }
}

// Usage in provider
class CachedProvider extends CustomAccessProvider {
  private cache = new ProviderCache();

  async getPublicKeys(): Promise<JWKSet> {
    const cacheKey = `jwks:${this.issuer}`;
    const cached = this.cache.get<JWKSet>(cacheKey);
    if (cached) {
      return cached;
    }

    const jwks = await super.getPublicKeys();
    this.cache.set(cacheKey, jwks, 3600); // Cache for 1 hour
    return jwks;
  }
}
```

### Metrics Collection

Add monitoring and metrics:

```typescript
interface ProviderMetrics {
  requestCount: number;
  successCount: number;
  errorCount: number;
  averageLatency: number;
  lastError?: string;
  lastErrorTime?: Date;
}

class MetricsCollector {
  private metrics = new Map<string, ProviderMetrics>();

  recordRequest(providerName: string, success: boolean, latency: number, error?: string): void {
    const current = this.metrics.get(providerName) || {
      requestCount: 0,
      successCount: 0,
      errorCount: 0,
      averageLatency: 0
    };

    current.requestCount++;
    if (success) {
      current.successCount++;
    } else {
      current.errorCount++;
      current.lastError = error;
      current.lastErrorTime = new Date();
    }

    // Update average latency
    current.averageLatency = 
      (current.averageLatency * (current.requestCount - 1) + latency) / current.requestCount;

    this.metrics.set(providerName, current);
  }

  getMetrics(providerName: string): ProviderMetrics | undefined {
    return this.metrics.get(providerName);
  }

  getAllMetrics(): Map<string, ProviderMetrics> {
    return new Map(this.metrics);
  }
}

// Usage in provider
class MonitoredProvider extends CustomAccessProvider {
  private static metricsCollector = new MetricsCollector();

  async mintCredentials(keyConfig: any, subject: string): Promise<Credentials> {
    const startTime = Date.now();
    
    try {
      const result = await super.mintCredentials(keyConfig, subject);
      const latency = Date.now() - startTime;
      
      MonitoredProvider.metricsCollector.recordRequest(this.name, true, latency);
      return result;
    } catch (error) {
      const latency = Date.now() - startTime;
      MonitoredProvider.metricsCollector.recordRequest(this.name, false, latency, error.message);
      throw error;
    }
  }
}
```

### Configuration Validation

Add configuration validation:

```typescript
import { IsString, IsNumber, IsOptional, IsUrl, validateSync } from 'class-validator';
import { Transform } from 'class-transformer';

export class CustomProviderConfig {
  @IsString()
  name: string;

  @IsString()
  type: string;

  @IsUrl()
  endpoint: string;

  @IsString()
  clientId: string;

  @IsString()
  clientSecret: string;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value))
  timeout?: number = 30000;

  @IsOptional()
  @IsNumber()
  @Transform(({ value }) => parseInt(value))
  retries?: number = 3;
}

// Validation function
export function validateProviderConfig(config: any): CustomProviderConfig {
  const configInstance = Object.assign(new CustomProviderConfig(), config);
  const errors = validateSync(configInstance);
  
  if (errors.length > 0) {
    const errorMessages = errors.map(error => 
      Object.values(error.constraints || {}).join(', ')
    ).join('; ');
    
    throw new Error(`Configuration validation failed: ${errorMessages}`);
  }
  
  return configInstance;
}
```

## Provider Factory

Create a factory for dynamic provider loading:

```typescript
// src/providers/provider.factory.ts
import { Injectable } from '@nestjs/common';
import { IdpProvider, AccessProvider } from '@voidkey/broker-core';
import { CustomIdpProvider } from './idp/custom-idp.provider';
import { CustomAccessProvider } from './access/custom-access.provider';

@Injectable()
export class ProviderFactory {
  createIdpProvider(type: string, config: any): IdpProvider {
    switch (type) {
      case 'custom-idp':
        return new CustomIdpProvider(config);
      default:
        throw new Error(`Unknown IdP provider type: ${type}`);
    }
  }

  createAccessProvider(type: string, config: any): AccessProvider {
    switch (type) {
      case 'custom-service':
        return new CustomAccessProvider(config);
      default:
        throw new Error(`Unknown access provider type: ${type}`);
    }
  }
}
```

## Plugin System

Implement a plugin system for external providers:

```typescript
// src/providers/plugin.interface.ts
export interface ProviderPlugin {
  name: string;
  version: string;
  createIdpProvider?(config: any): IdpProvider;
  createAccessProvider?(config: any): AccessProvider;
}

// src/providers/plugin.registry.ts
export class PluginRegistry {
  private plugins = new Map<string, ProviderPlugin>();

  register(plugin: ProviderPlugin): void {
    this.plugins.set(plugin.name, plugin);
  }

  getPlugin(name: string): ProviderPlugin | undefined {
    return this.plugins.get(name);
  }

  loadPlugin(pluginPath: string): void {
    const plugin = require(pluginPath);
    this.register(plugin.default || plugin);
  }
}
```

## Deployment

### Building Custom Providers

```dockerfile
# Dockerfile for custom provider
FROM node:18-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:18-alpine AS runtime
WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

USER 1001
EXPOSE 3000

CMD ["node", "dist/main.js"]
```

### Configuration Management

```yaml
# docker-compose.yml with custom provider
version: '3.8'

services:
  voidkey-broker:
    build: .
    environment:
      - CUSTOM_CLOUD_SECRET=${CUSTOM_CLOUD_SECRET}
      - CUSTOM_IDP_SECRET=${CUSTOM_IDP_SECRET}
    volumes:
      - ./config:/app/config:ro
      - ./plugins:/app/plugins:ro
```

## Next Steps

- [Identity Providers](/providers/identity/) - Understand built-in IdP providers
- [Access Providers](/providers/access/) - Understand built-in access providers
- [Development Setup](/development/setup/) - Set up development environment
- [API Reference](/api/rest/) - Integrate with the broker API