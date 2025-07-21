# CI/CD Implementation Guide

## Overview

This document describes the CI/CD pipeline implemented for the aichmi AI reservation bot application.

## Architecture

The application is structured as a monorepo with:
- **Frontend**: React application built with Vite (`aichmi_frontend/`)
- **Backend**: Node.js/Express API server (`aichmi_backend/`)
- **Database**: PostgreSQL with setup scripts (`aichmi_db/`)

## CI/CD Workflows

### Continuous Integration (`ci.yml`)

Runs on: Push to `main`/`develop` branches and all pull requests

**Job 1: Lint and Security**
- ESLint checking (with error tolerance)
- Security audits using `npm audit`
- Secret scanning using TruffleHog
- Uses Node.js 20.x

**Job 2: Build and Test**
- Tests on Node.js 18.x and 20.x
- Frontend build verification
- Test execution (when tests exist)
- Artifact upload (build outputs)

### Continuous Deployment (`cd.yml`)

Runs on: Push to `main` branch and manual trigger

**Features:**
- Docker image building
- Deployment package preparation
- Artifact upload for deployment
- Health check placeholders

## Docker Configuration

### Multi-stage Dockerfile
1. **Frontend Builder**: Builds React application
2. **Backend**: Sets up Node.js server with built frontend

### Security Features
- Non-root user execution
- Health checks
- Minimal alpine-based images

## Project Scripts

Root-level package.json provides workspace management:

```bash
npm run install:all    # Install all dependencies
npm run build          # Build frontend
npm run start          # Start backend
npm run lint           # Run frontend linting
npm run audit          # Security audit all packages
```

## Environment Configuration

### Required Environment Variables

Copy `.env.example` to `.env` and configure:

- **Server**: `PORT`, `NODE_ENV`
- **Database**: `DATABASE_URL`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`
- **Security**: `JWT_SECRET`, `SESSION_SECRET`
- **APIs**: `GOOGLE_AI_API_KEY`, `STRIPE_SECRET_KEY`
- **OAuth**: Google/Facebook client credentials

### GitHub Secrets for CI/CD

For production deployment, configure these secrets in GitHub:

- `DATABASE_URL`: Production database connection
- `JWT_SECRET`: Production JWT secret
- `GOOGLE_AI_API_KEY`: AI service API key
- `STRIPE_SECRET_KEY`: Payment processing key
- Cloud provider credentials (AWS/GCP/Azure keys)

## Deployment Options

### Option 1: Docker Compose (Local/VPS)
```bash
# Download deployment artifacts
# Extract and run:
docker-compose up -d
```

### Option 2: Cloud Platforms

**Heroku:**
```bash
heroku container:push web
heroku container:release web
```

**Google Cloud Run:**
```bash
gcloud run deploy --image gcr.io/PROJECT/aichmi
```

**AWS ECS/Fargate:**
```bash
aws ecs update-service --service aichmi
```

## Status Badges

Add to README.md:
```markdown
[![CI](https://github.com/SotirisKav/aichmi/actions/workflows/ci.yml/badge.svg)](https://github.com/SotirisKav/aichmi/actions/workflows/ci.yml)
[![CD](https://github.com/SotirisKav/aichmi/actions/workflows/cd.yml/badge.svg)](https://github.com/SotirisKav/aichmi/actions/workflows/cd.yml)
```

## Monitoring and Maintenance

### Health Checks
- API endpoint: `/api/health`
- Docker health check included
- Database connectivity verification

### Security
- Automated dependency updates via Dependabot (optional)
- Secret scanning on every commit
- Regular security audits

### Performance
- Build artifacts cached between runs
- Multi-stage Docker builds for efficiency
- Compressed deployment packages

## Troubleshooting

### Common Issues

1. **ESLint errors**: Currently set to continue on error
   - Fix: Address linting issues in `aichmi_frontend/src/`

2. **Missing environment variables**: Server won't start without proper config
   - Fix: Ensure `.env` file is properly configured

3. **Docker build timeouts**: Large dependency installation
   - Fix: Consider using Docker layer caching in production

4. **Database connection failures**: Missing PostgreSQL setup
   - Fix: Ensure database is running and configured

## Next Steps

1. **Add Tests**: Replace placeholder test steps with actual test suites
2. **Environment Secrets**: Configure production secrets in GitHub
3. **Deployment Target**: Choose and configure cloud provider
4. **Monitoring**: Add application monitoring and alerting
5. **Performance**: Optimize build times and bundle sizes