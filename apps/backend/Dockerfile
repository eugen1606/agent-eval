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

WORKDIR /app

# Enable corepack for yarn
RUN corepack enable

# Copy package files and yarn config
COPY package.json yarn.lock .yarnrc.yml ./

# Install only production dependencies
RUN yarn workspaces focus --production

# Copy built application
COPY --from=builder /app/dist/apps/backend ./dist

# Create data directory
RUN mkdir -p /app/data/sessions

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/main.js"]
