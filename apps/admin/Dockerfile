# Multi-stage build for Admin Dashboard
# Build context should be set to the ROOT of the repository

# Stage 1: Dependencies and Build
FROM node:18-alpine AS builder

# Enable corepack for pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Set working directory
WORKDIR /app

# Copy root-level package files (for monorepo support)
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./

# Copy admin app package files and source
COPY apps/admin/ ./apps/admin/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build admin app (works for both monorepo and standalone)
# If monorepo: --filter admin will work
# If standalone: we'll cd into apps/admin and build
RUN if pnpm list --filter admin >/dev/null 2>&1; then \
      pnpm run build --filter admin; \
    else \
      cd apps/admin && pnpm run build; \
    fi

# Stage 2: Production server
FROM node:18-alpine AS runner

# Install serve globally
RUN npm install -g serve

# Set working directory
WORKDIR /app

# Copy built files from builder stage
COPY --from=builder /app/apps/admin/dist ./dist

# Expose port (Railway will set PORT env var)
EXPOSE 3000

# Use serve to host the SPA with proper routing
# -s flag enables SPA mode (serves index.html for all routes)
# -l flag sets the listen port from PORT environment variable
CMD ["sh", "-c", "serve -s dist -l ${PORT:-3000}"]
