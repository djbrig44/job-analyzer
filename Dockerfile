FROM mcr.microsoft.com/playwright:v1.50.0-jammy

WORKDIR /app
COPY package*.json ./
RUN npm install
RUN npx playwright install chromium
COPY . .
RUN npm run build

EXPOSE 8080
CMD ["node", "server/index.js"]
