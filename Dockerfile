# Build stage
FROM node:16-alpine AS builder

# Install git
RUN apk add --no-cache git

# Add build argument for cache busting
ARG CACHEBUST=1

# Clone the repository (this step will not be cached due to CACHEBUST)
RUN git clone https://github.com/adamskrodzki/spinwheel.git /app
WORKDIR /app

# Install dependencies and build
RUN npm install

# Runtime stage
FROM node:16-alpine

WORKDIR /app

# Copy built application from builder stage
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server.js ./
COPY --from=builder /app/public ./public

# Expose the port your app runs on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
