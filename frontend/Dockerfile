# Build stage
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
# Set build environment variables if needed
# ARG NEXT_PUBLIC_API_URL
# ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

RUN npm run build

# Production stage
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

COPY --from=builder /app/public ./public
COPY --from=builder /app/public ./frontend/public
COPY --from=builder /app/public ./app/public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/.next/static ./frontend/.next/static
COPY --from=builder /app/.next/static ./app/.next/static

EXPOSE 3000

CMD ["sh", "-c", "if [ -f /app/server.js ]; then node /app/server.js; elif [ -f /app/frontend/server.js ]; then node /app/frontend/server.js; elif [ -f /app/app/server.js ]; then node /app/app/server.js; else echo 'server.js not found'; find /app -maxdepth 5 -name server.js; exit 1; fi"]
