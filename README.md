# aichmi

[![CI](https://github.com/SotirisKav/aichmi/actions/workflows/ci.yml/badge.svg)](https://github.com/SotirisKav/aichmi/actions/workflows/ci.yml)
[![CD](https://github.com/SotirisKav/aichmi/actions/workflows/cd.yml/badge.svg)](https://github.com/SotirisKav/aichmi/actions/workflows/cd.yml)

This repository contains the implementation for a fully functional AI reservation bot

## Architecture

This is a full-stack web application consisting of:

- **Backend** (`aichmi_backend/`): Node.js/Express API server
- **Frontend** (`aichmi_frontend/`): React application built with Vite
- **Database** (`aichmi_db/`): PostgreSQL database with setup scripts

## Development

### Prerequisites

- Node.js 18.x or 20.x
- npm
- PostgreSQL (for local development)

### Quick Start

1. Clone the repository
2. Install dependencies:
   ```bash
   cd aichmi_frontend && npm install
   cd ../aichmi_backend && npm install
   ```
3. Build and run:
   ```bash
   cd aichmi_frontend && npm run build
   cd ../aichmi_backend && npm start
   ```

### Available Scripts

**Frontend** (`aichmi_frontend/`):
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

**Backend** (`aichmi_backend/`):
- `npm run devStart` - Start with nodemon (development)
- `npm start` - Start production server
- `npm run build-and-start` - Build frontend and start backend

## CI/CD

This project uses GitHub Actions for continuous integration and deployment:

### Continuous Integration (CI)
- Runs on every push to `main`/`develop` and all pull requests
- Tests on Node.js 18.x and 20.x
- Installs dependencies for both frontend and backend
- Runs linting and builds frontend
- Performs security audits
- Uploads build artifacts

### Continuous Deployment (CD)
- Deploys on pushes to `main` branch
- Can be triggered manually via GitHub Actions
- Prepares deployment packages
- Uploads deployment artifacts

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Ensure CI passes
5. Submit a pull request
