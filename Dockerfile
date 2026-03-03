FROM mcr.microsoft.com/playwright:v1.50.0-jammy
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx playwright install chromium
RUN npm run build
EXPOSE 8080
ENV NODE_ENV=production
CMD ["node", "server/index.js"]
