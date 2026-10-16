FROM node:22-bookworm-slim AS build

ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_SITE_URL=https://mindsoftacademy.com \
    NEXT_PUBLIC_TELEGRAM_BOT=mindsoft_academy_bot

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
COPY scripts/prisma-generate.mjs scripts/prisma-env.mjs scripts/prisma-migrate.mjs scripts/

RUN npm ci --include=dev

COPY . .
RUN npm run build

FROM node:22-bookworm-slim AS run

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    DATA_DIR=/var/data \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_PUBLIC_SITE_URL=https://mindsoftacademy.com

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /var/data \
  && chown -R node:node /var/data

WORKDIR /app

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/fonts ./fonts

USER node
EXPOSE 3000
VOLUME ["/var/data"]

CMD ["node", "server.js"]
