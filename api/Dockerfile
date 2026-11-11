# API followmetravel — image de production.
#   docker build -t <registry>/followmetravel-api:<tag> api/
#
# Debian slim plutôt qu'alpine : argon2 publie des binaires précompilés glibc,
# pas besoin de toolchain dans l'image.

FROM node:22.20.0-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build && npm prune --omit=dev

FROM node:22.20.0-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./
COPY migrations ./migrations
COPY assets ./assets
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
