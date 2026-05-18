# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy project files
COPY . .

# Generate Prisma client
RUN npm run db:generate

# Build application
RUN npm run build

# Runtime stage
FROM node:20-slim

WORKDIR /app

# Install OpenSSL
RUN apt-get update && apt-get install -y openssl

# Copy package files
COPY package*.json ./

# Install production dependencies
RUN npm ci --omit=dev

# Copy build output and Prisma files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/prisma ./prisma
COPY entrypoint.sh ./entrypoint.sh

# IMPORTANT: copy generated Prisma client
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# Make entrypoint executable
RUN chmod +x ./entrypoint.sh

# Expose API port
EXPOSE 5000

# Start application
ENTRYPOINT ["/app/entrypoint.sh"]

CMD ["node", "dist/server.js"]