# syntax=docker/dockerfile:1

# ---- Stage 1: Build ----
FROM node:22 AS builder

RUN corepack enable
RUN corepack prepare yarn@4.5.3 --activate

WORKDIR /app

# Root workspace config
COPY .yarnrc.yml package.json yarn.lock tsconfig.base.json ./

# Package.json for each workspace member (dependency resolution)
COPY packages/design-tokens/package.json ./packages/design-tokens/
COPY packages/design-vue/package.json ./packages/design-vue/
COPY apps/client/package.json ./apps/client/

# Install dependencies (skip postinstall hooks until source is copied)
RUN yarn install --mode=skip-build

# Design system source + build
COPY packages/design-tokens/ ./packages/design-tokens/
COPY packages/design-vue/ ./packages/design-vue/
RUN yarn workspace @imjohnkoo/design-tokens run build
RUN yarn workspace @imjohnkoo/design-vue run build

# Client source + Nuxt prepare + build
COPY apps/client/ ./apps/client/
RUN yarn workspace nomacom-client run postinstall
# Node heap 확장 — Nuxt/Nitro build 가 기본 2GB 초과 가능.
ENV NODE_OPTIONS=--max-old-space-size=4096
# ⭐ typecheck 게이트 — 배포 경로의 최종 방어선 (INF-3, 2026-09-02).
#
# `prod` 브랜치에는 ci.yml 이 붙어 있지 않다(`branches: [dev]`). 즉 dev 를 거치지 않고
# prod 로 올리거나 CI 실패를 무시하고 머지하면, 그때까지 아무 기계 검증도 없이
# 이미지가 만들어져 EC2 까지 간다. 여기서 막으면 **어떤 경로로 배포하든** 판정된다 —
# 실패 시 이미지가 안 만들어지므로 push 도 CodeDeploy 도 실행되지 않는다.
#
# CI·로컬과 **같은 스크립트·같은 기준선**을 쓴다. 세 곳의 판정이 갈리면
# "CI 는 통과했는데 배포에서 깨졌다" 가 생긴다. 기준선: admin 0 / client 7.
# test 는 넣지 않는다 — ci.yml 이 이미 돌리고, 여기서 실패하면 prod ref 가
# 이미 옮겨진 뒤라 드리프트만 남는다.
COPY .github/typecheck-baseline/client.txt ./.github/typecheck-baseline/
COPY .github/scripts/typecheck-gate.sh ./.github/scripts/
RUN bash .github/scripts/typecheck-gate.sh client

RUN yarn workspace nomacom-client run build

# ---- Stage 2: Runtime ----
FROM node:22-slim

WORKDIR /app

# Copy only the production build output
COPY --from=builder /app/apps/client/.output ./.output
COPY --from=builder /app/apps/client/package.json ./

EXPOSE 3000

CMD ["node", ".output/server/index.mjs"]
