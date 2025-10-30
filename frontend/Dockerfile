# Stage 1: install dependencies and build source
FROM node:18-alpine AS base

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install
COPY . .

# Expose the development port
EXPOSE 5173

# Default command runs the dev server. Using --host makes it accessible
# outside of the container (important for Docker Compose). In production
# you could replace this with `npm run build` and serve the static
# files via Nginx, but for the MVP we prefer the live dev server.
CMD ["npm", "run", "dev", "--", "--host"]