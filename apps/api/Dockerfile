# Use Node.js 20 Alpine for lightweight image
FROM node:20-alpine

# Enable pnpm via corepack (comes with Node 20)
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

# Set working directory to root of monorepo
WORKDIR /app

# Copy root package files for monorepo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml* ./

# Copy all workspace package.json files
COPY apps/api/package.json ./apps/api/
COPY apps/admin/package.json ./apps/admin/
COPY apps/widget/package.json ./apps/widget/

# Set CI mode for pnpm
ENV CI=true

# Install all dependencies (monorepo)
RUN pnpm install --no-frozen-lockfile

# Copy the entire monorepo
COPY . .

# Set working directory to API
WORKDIR /app/apps/api

# Expose port 4000 (Railway will override with PORT env var at runtime)
EXPOSE 4000

# Start the application
CMD ["node", "index.js"]
