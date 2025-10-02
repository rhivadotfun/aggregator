# syntax = docker/dockerfile:1.2

FROM node:lts-alpine AS base

ENV NODE_ENV="production"

RUN apk update -qq \
    && apk add --no-cache curl unzip bash ca-certificates \
    && curl -fsSL https://bun.sh/install | bash

ENV PATH="/root/.bun/bin:$PATH"

FROM base as codegen
WORKDIR /usr/src/app

# Copy source code
COPY packages ./packages
COPY servers ./servers
COPY turbo.json ./turbo.json
COPY bun.lock ./bun.lock
COPY package.json ./package.json

# Run turbo prune for docker build
RUN bun install turbo --global && \
    bun x turbo prune @rhiva-ag/trpc @rhiva-ag/worker @rhiva-ag/metrics --docker

FROM base as builder
WORKDIR /usr/src/app
ARG SENTRY_AUTH_TOKEN
ENV SENTRY_AUTH_TOKEN=${SENTRY_AUTH_TOKEN}

COPY --from=codegen /usr/src/app/out/json .
RUN --mount=type=cache,target=/root/.bun/cache\
    bun install --frozen-lockfine

COPY --from=codegen /usr/src/app/out/full . 
COPY --from=codegen /usr/src/app/servers/ecosystem.config.js servers/ecosystem.config.js
RUN bun x turbo check

FROM base as runtime
WORKDIR /usr/src/app

COPY --from=builder /usr/src/app/ .

ENV HOST="0.0.0.0"
ENV NODE_ENV=production

FROM runtime as dev
WORKDIR /usr/src/app/servers
CMD ["bun", "x", "pm2-runtime", "start", "ecosystem.config.js"]

FROM runtime as trpc 
WORKDIR /usr/src/app/servers/trpc
CMD ["bun", "src/index.ts"]

FROM runtime as tasks 
WORKDIR /usr/src/app/servers/worker
CMD ["bun", "src/tasks/index.ts"]

FROM runtime as jobs
WORKDIR /usr/src/app/servers/worker
CMD ["bun", "src/jobs/index.ts"]

FROM runtime as metrics 
WORKDIR /usr/src/app/servers/metrics
CMD ["bun", "src/index.ts"]
