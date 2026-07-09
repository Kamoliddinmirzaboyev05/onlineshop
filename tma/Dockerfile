FROM node:20-alpine

WORKDIR /app

COPY package.json ./
RUN npm install

COPY . .

EXPOSE 5173

# Dev server (HMR). For production: `npm run build` then serve dist/ via nginx.
CMD ["npm", "run", "dev"]
