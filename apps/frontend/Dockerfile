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

# Build the frontend
RUN yarn nx build frontend --configuration=production

# Production stage with nginx
FROM nginx:alpine AS production

# Copy built application
COPY --from=builder /app/dist/apps/frontend /usr/share/nginx/html

# Copy nginx configuration
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
