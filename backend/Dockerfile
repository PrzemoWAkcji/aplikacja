# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Set DATABASE_URL for build time (required by Prisma 6.x generate)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

COPY package*.json ./
RUN npm install

COPY . .
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

# Real DATABASE_URL will come from docker-compose
CMD ["node", "dist/src/main.js"]
