# Multi-stage Dockerfile for production deployment
FROM node:20-alpine AS frontend-builder

WORKDIR /app/frontend
COPY aichmi_frontend/package*.json ./
RUN npm install

COPY aichmi_frontend/ ./
RUN npm run build

# Backend stage
FROM node:20-alpine AS backend

WORKDIR /app

# Install backend dependencies
COPY aichmi_backend/package*.json ./
RUN npm install --omit=dev

# Copy backend source
COPY aichmi_backend/ ./

# Copy built frontend
COPY --from=frontend-builder /app/frontend/dist ./frontend_dist

# Copy database scripts
COPY aichmi_db/ ./db/

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Set ownership
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1))"

# Start the application
CMD ["npm", "start"]