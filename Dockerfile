FROM node:22-slim

# Install Playwright Chromium system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
    libxkbcommon0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 \
    libpango-1.0-0 libcairo2 libasound2 libxshmfence1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package*.json ./
RUN npm ci --include=dev

# Install Playwright Chromium only
RUN npx playwright install chromium

# Copy source and build frontend
COPY . .
RUN npm run build

EXPOSE 8080
ENV NODE_ENV=production
CMD ["node", "server/index.js"]
