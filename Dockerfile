# Build stage
FROM node:16-alpine AS builder

# Install git
RUN apk add --no-cache git

# Clone the repository
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

# Create data directory
RUN mkdir -p /app/data

# Expose the port your app runs on
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
