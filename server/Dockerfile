# Base stage
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# Builder stage
FROM base AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --no-frozen-lockfile
COPY . .
RUN npx prisma generate
RUN pnpm run build
RUN pnpm prune --prod

# Runner stage
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy specific things we need
# We copy node_modules from builder because it contains the generated prisma client
# and has been pruned to only production dependencies
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./
COPY public ./public
RUN touch .env


EXPOSE 8000
CMD ["node", "dist/index.cjs"]
