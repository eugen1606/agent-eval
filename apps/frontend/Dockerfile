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

# Create non-root user for nginx
RUN addgroup -g 1001 -S nginx-user && \
    adduser -S nginx-user -u 1001 -G nginx-user

# Copy built application
COPY --from=builder /app/dist/apps/frontend /usr/share/nginx/html

# Copy nginx configuration as template (envsubst runs at startup)
COPY apps/frontend/nginx.conf /etc/nginx/templates/default.conf.template

# Create necessary directories and set permissions
RUN mkdir -p /var/cache/nginx /var/run/nginx /var/log/nginx /etc/nginx/conf.d && \
    chown -R nginx-user:nginx-user /var/cache/nginx /var/run/nginx /var/log/nginx /usr/share/nginx/html /etc/nginx/conf.d && \
    chmod -R 755 /var/cache/nginx /var/run/nginx

# Update template to run as non-root (change port 80 to 8080)
RUN sed -i 's/listen\s*80;/listen 8080;/g' /etc/nginx/templates/default.conf.template && \
    sed -i 's/listen\s*\[::\]:80;/listen [::]:8080;/g' /etc/nginx/templates/default.conf.template

# Default backend connection
ENV BACKEND_HOST=backend
ENV BACKEND_PORT=3000
# Only substitute these vars (don't touch other nginx variables like $uri)
ENV NGINX_ENVSUBST_OUTPUT_DIR=/etc/nginx/conf.d
ENV NGINX_ENVSUBST_FILTER=BACKEND

# Switch to non-root user
USER nginx-user

EXPOSE 8080

CMD ["nginx", "-g", "daemon off;"]
