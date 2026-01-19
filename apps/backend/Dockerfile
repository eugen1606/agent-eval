# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Enable corepack for yarn
RUN corepack enable

# Copy package files and yarn config
COPY package.json yarn.lock .yarnrc.yml ./

# Install dependencies
RUN yarn install --immutable

# Copy source files
COPY . .

# Build the backend
RUN yarn nx build backend --configuration=production

# Production stage
FROM node:20-alpine AS production

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 -G nodejs

WORKDIR /app

# Enable corepack for yarn
RUN corepack enable

# Copy package files and yarn config
COPY package.json yarn.lock .yarnrc.yml ./

# Install only production dependencies
RUN yarn workspaces focus --production

# Copy built application
COPY --from=builder /app/dist/apps/backend ./dist

# Create data directory with proper ownership
RUN mkdir -p /app/data/sessions && \
    chown -R nodejs:nodejs /app

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Switch to non-root user
USER nodejs

EXPOSE 3000

CMD ["node", "dist/main.js"]
