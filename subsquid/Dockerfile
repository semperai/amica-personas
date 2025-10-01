FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY yarn.lock ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build the project
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
COPY yarn.lock ./
RUN npm install --production

# Copy built code from builder
COPY --from=builder /app/lib ./lib
COPY --from=builder /app/schema.graphql ./schema.graphql
COPY --from=builder /app/db ./db

# Default command (can be overridden)
CMD ["node", "-r", "dotenv/config", "lib/main.js"]
