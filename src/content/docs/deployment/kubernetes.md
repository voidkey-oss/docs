---
title: Kubernetes Deployment
description: Deploy Voidkey on Kubernetes
---

This guide covers deploying Voidkey on Kubernetes for production workloads.

## Quick Start

Deploy Voidkey using Helm:

```bash
# Add Helm repository
helm repo add voidkey https://charts.voidkey.io
helm repo update

# Install with default values
helm install voidkey voidkey/voidkey-broker

# Or with custom values
helm install voidkey voidkey/voidkey-broker -f values.yaml
```

## Kubernetes Manifests

### Namespace

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: voidkey
  labels:
    name: voidkey
```

### ConfigMap

```yaml
# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: voidkey-config
  namespace: voidkey
data:
  config.yaml: |
    brokerIdp:
      name: "keycloak"
      issuer: "https://auth.example.com/realms/voidkey"
      audience: "voidkey-broker"
      clientId: "broker-service"
      clientSecret: "PLACEHOLDER"  # Will be replaced by secret

    clientIdps:
      - name: "github-actions"
        issuer: "https://token.actions.githubusercontent.com"
        audience: "https://github.com/myorg"

    accessProviders:
      - name: "aws-prod"
        type: "aws-sts"
        region: "us-east-1"
        externalId: "PLACEHOLDER"  # Will be replaced by secret

    clientIdentities:
      - subject: "repo:myorg/myapp:ref:refs/heads/main"
        idp: "github-actions"
        keys:
          AWS_PROD_DEPLOY:
            provider: "aws-prod"
            roleArn: "arn:aws:iam::123456789012:role/VoidkeyRole"
            duration: 3600
```

### Secret

```yaml
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: voidkey-secrets
  namespace: voidkey
type: Opaque
data:
  # Base64 encoded values
  broker-client-secret: YnJva2VyLXNlY3JldC0xMjM0NQ==
  aws-external-id: YXdzLWV4dGVybmFsLWlkLTEyMzQ1
```

### Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: voidkey-broker
  namespace: voidkey
  labels:
    app: voidkey-broker
spec:
  replicas: 3
  selector:
    matchLabels:
      app: voidkey-broker
  template:
    metadata:
      labels:
        app: voidkey-broker
    spec:
      serviceAccountName: voidkey-broker
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      containers:
      - name: voidkey-broker
        image: voidkey/broker:latest
        imagePullPolicy: Always
        ports:
        - containerPort: 3000
          name: http
          protocol: TCP
        env:
        - name: NODE_ENV
          value: "production"
        - name: LOG_LEVEL
          value: "info"
        - name: PORT
          value: "3000"
        - name: BROKER_CLIENT_SECRET
          valueFrom:
            secretKeyRef:
              name: voidkey-secrets
              key: broker-client-secret
        - name: AWS_EXTERNAL_ID
          valueFrom:
            secretKeyRef:
              name: voidkey-secrets
              key: aws-external-id
        volumeMounts:
        - name: config
          mountPath: /app/config
          readOnly: true
        - name: tmp
          mountPath: /tmp
        resources:
          requests:
            memory: "256Mi"
            cpu: "100m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 30
          periodSeconds: 10
          timeoutSeconds: 5
          failureThreshold: 3
        readinessProbe:
          httpGet:
            path: /health
            port: http
          initialDelaySeconds: 5
          periodSeconds: 5
          timeoutSeconds: 3
          failureThreshold: 3
        securityContext:
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
          capabilities:
            drop:
            - ALL
      volumes:
      - name: config
        configMap:
          name: voidkey-config
      - name: tmp
        emptyDir: {}
```

### Service

```yaml
# service.yaml
apiVersion: v1
kind: Service
metadata:
  name: voidkey-broker
  namespace: voidkey
  labels:
    app: voidkey-broker
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: http
    protocol: TCP
    name: http
  selector:
    app: voidkey-broker
```

### ServiceAccount

```yaml
# serviceaccount.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: voidkey-broker
  namespace: voidkey

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRole
metadata:
  name: voidkey-broker
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list", "watch"]

---
apiVersion: rbac.authorization.k8s.io/v1
kind: ClusterRoleBinding
metadata:
  name: voidkey-broker
roleRef:
  apiGroup: rbac.authorization.k8s.io
  kind: ClusterRole
  name: voidkey-broker
subjects:
- kind: ServiceAccount
  name: voidkey-broker
  namespace: voidkey
```

### Ingress

```yaml
# ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: voidkey-broker
  namespace: voidkey
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/ssl-redirect: "true"
    nginx.ingress.kubernetes.io/backend-protocol: "HTTP"
spec:
  tls:
  - hosts:
    - voidkey.example.com
    secretName: voidkey-tls
  rules:
  - host: voidkey.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: voidkey-broker
            port:
              number: 80
```

## Helm Chart

### Chart.yaml

```yaml
# Chart.yaml
apiVersion: v2
name: voidkey-broker
description: A Helm chart for Voidkey credential broker
type: application
version: 0.8.0
appVersion: "0.8.0"
maintainers:
- name: voidkey-team
  email: team@voidkey.io
sources:
- https://github.com/voidkey-oss/voidkey
```

### values.yaml

```yaml
# values.yaml
replicaCount: 3

image:
  repository: voidkey/broker
  pullPolicy: IfNotPresent
  tag: "latest"

serviceAccount:
  create: true
  annotations: {}
  name: ""

podAnnotations: {}

podSecurityContext:
  runAsNonRoot: true
  runAsUser: 1001
  fsGroup: 1001

securityContext:
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
    - ALL

service:
  type: ClusterIP
  port: 80

ingress:
  enabled: true
  className: "nginx"
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
  hosts:
    - host: voidkey.example.com
      paths:
        - path: /
          pathType: Prefix
  tls:
    - secretName: voidkey-tls
      hosts:
        - voidkey.example.com

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 100m
    memory: 256Mi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80
  targetMemoryUtilizationPercentage: 80

nodeSelector: {}
tolerations: []
affinity: {}

config:
  brokerIdp:
    name: "keycloak"
    issuer: "https://auth.example.com/realms/voidkey"
    audience: "voidkey-broker"
    clientId: "broker-service"
  
  clientIdps:
    - name: "github-actions"
      issuer: "https://token.actions.githubusercontent.com"
      audience: "https://github.com/myorg"
  
  accessProviders:
    - name: "aws-prod"
      type: "aws-sts"
      region: "us-east-1"
  
  clientIdentities:
    - subject: "repo:myorg/myapp:ref:refs/heads/main"
      idp: "github-actions"
      keys:
        AWS_PROD_DEPLOY:
          provider: "aws-prod"
          roleArn: "arn:aws:iam::123456789012:role/VoidkeyRole"
          duration: 3600

secrets:
  brokerClientSecret: ""
  awsExternalId: ""

monitoring:
  enabled: true
  serviceMonitor:
    enabled: true
    interval: 30s
    path: /metrics
```

### Templates

Helm templates with proper templating:

```yaml
# templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ include "voidkey-broker.fullname" . }}
  labels:
    {{- include "voidkey-broker.labels" . | nindent 4 }}
spec:
  {{- if not .Values.autoscaling.enabled }}
  replicas: {{ .Values.replicaCount }}
  {{- end }}
  selector:
    matchLabels:
      {{- include "voidkey-broker.selectorLabels" . | nindent 6 }}
  template:
    metadata:
      {{- with .Values.podAnnotations }}
      annotations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      labels:
        {{- include "voidkey-broker.selectorLabels" . | nindent 8 }}
    spec:
      {{- with .Values.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      serviceAccountName: {{ include "voidkey-broker.serviceAccountName" . }}
      securityContext:
        {{- toYaml .Values.podSecurityContext | nindent 8 }}
      containers:
        - name: {{ .Chart.Name }}
          securityContext:
            {{- toYaml .Values.securityContext | nindent 12 }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag | default .Chart.AppVersion }}"
          imagePullPolicy: {{ .Values.image.pullPolicy }}
          ports:
            - name: http
              containerPort: 3000
              protocol: TCP
          env:
            - name: NODE_ENV
              value: "production"
            - name: BROKER_CLIENT_SECRET
              valueFrom:
                secretKeyRef:
                  name: {{ include "voidkey-broker.fullname" . }}-secrets
                  key: broker-client-secret
          volumeMounts:
            - name: config
              mountPath: /app/config
              readOnly: true
          livenessProbe:
            httpGet:
              path: /health
              port: http
          readinessProbe:
            httpGet:
              path: /health
              port: http
          resources:
            {{- toYaml .Values.resources | nindent 12 }}
      volumes:
        - name: config
          configMap:
            name: {{ include "voidkey-broker.fullname" . }}-config
      {{- with .Values.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with .Values.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
```

## High Availability Setup

### Multi-Zone Deployment

```yaml
# Pod Anti-Affinity for spreading across zones
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
    - weight: 100
      podAffinityTerm:
        labelSelector:
          matchExpressions:
          - key: app
            operator: In
            values:
            - voidkey-broker
        topologyKey: topology.kubernetes.io/zone
```

### Horizontal Pod Autoscaler

```yaml
# hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: voidkey-broker
  namespace: voidkey
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: voidkey-broker
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
      - type: Percent
        value: 10
        periodSeconds: 60
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 50
        periodSeconds: 60
      - type: Pods
        value: 2
        periodSeconds: 60
      selectPolicy: Max
```

### Pod Disruption Budget

```yaml
# pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: voidkey-broker
  namespace: voidkey
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: voidkey-broker
```

## Monitoring

### ServiceMonitor (Prometheus)

```yaml
# servicemonitor.yaml
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: voidkey-broker
  namespace: voidkey
  labels:
    app: voidkey-broker
spec:
  selector:
    matchLabels:
      app: voidkey-broker
  endpoints:
  - port: http
    path: /metrics
    interval: 30s
    scrapeTimeout: 10s
```

### Grafana Dashboard

```json
{
  "dashboard": {
    "title": "Voidkey Broker",
    "panels": [
      {
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{job=\"voidkey-broker\"}[5m])"
          }
        ]
      },
      {
        "title": "Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job=\"voidkey-broker\"}[5m]))"
          }
        ]
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{job=\"voidkey-broker\",status=~\"5..\"}[5m])"
          }
        ]
      }
    ]
  }
}
```

## Security

### Network Policies

```yaml
# networkpolicy.yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: voidkey-broker
  namespace: voidkey
spec:
  podSelector:
    matchLabels:
      app: voidkey-broker
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to: []
    ports:
    - protocol: TCP
      port: 443  # HTTPS to external IdPs
    - protocol: TCP
      port: 53   # DNS
    - protocol: UDP
      port: 53   # DNS
```

### Pod Security Standards

```yaml
# pod-security-policy.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: voidkey
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

## Operations

### Installation

```bash
# Create namespace
kubectl create namespace voidkey

# Install with Helm
helm install voidkey voidkey/voidkey-broker \
  --namespace voidkey \
  --set config.brokerIdp.clientSecret="your-secret" \
  --set secrets.awsExternalId="your-external-id" \
  --set ingress.hosts[0].host="voidkey.example.com"
```

### Upgrades

```bash
# Update Helm repository
helm repo update

# Upgrade release
helm upgrade voidkey voidkey/voidkey-broker \
  --namespace voidkey \
  --reuse-values

# Check upgrade status
kubectl rollout status deployment/voidkey-broker -n voidkey
```

### Scaling

```bash
# Manual scaling
kubectl scale deployment voidkey-broker --replicas=5 -n voidkey

# Enable autoscaling
kubectl autoscale deployment voidkey-broker \
  --cpu-percent=70 \
  --min=3 \
  --max=10 \
  -n voidkey
```

### Troubleshooting

```bash
# Check pod status
kubectl get pods -n voidkey

# View logs
kubectl logs -f deployment/voidkey-broker -n voidkey

# Describe pod for events
kubectl describe pod <pod-name> -n voidkey

# Check service endpoints
kubectl get endpoints -n voidkey

# Test connectivity
kubectl run debug --image=busybox:1.28 --rm -it --restart=Never -- sh
```

## Backup and Recovery

### Configuration Backup

```bash
# Backup Kubernetes resources
kubectl get configmap,secret,deployment,service,ingress -n voidkey -o yaml > voidkey-backup.yaml

# Backup Helm values
helm get values voidkey -n voidkey > voidkey-values.yaml
```

### Disaster Recovery

```bash
# Recreate namespace
kubectl create namespace voidkey

# Restore from backup
kubectl apply -f voidkey-backup.yaml

# Or reinstall with Helm
helm install voidkey voidkey/voidkey-broker \
  --namespace voidkey \
  -f voidkey-values.yaml
```

## Performance Tuning

### JVM Tuning (if applicable)

```yaml
env:
- name: NODE_OPTIONS
  value: "--max-old-space-size=384"
```

### Resource Optimization

```yaml
resources:
  requests:
    memory: "256Mi"
    cpu: "100m"
  limits:
    memory: "512Mi"
    cpu: "500m"
```

### Connection Pooling

Configure HTTP agent settings:

```yaml
env:
- name: HTTP_AGENT_KEEP_ALIVE
  value: "true"
- name: HTTP_AGENT_MAX_SOCKETS
  value: "50"
```

## Next Steps

- [Production Deployment](/deployment/production/) - Production best practices
- [Docker Deployment](/deployment/docker/) - Docker-specific deployment
- [Monitoring Guide](/monitoring/setup/) - Set up monitoring
- [Security Guide](/architecture/security/) - Security considerations