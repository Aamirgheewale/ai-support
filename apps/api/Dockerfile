# Use Node.js 20 Alpine for lightweight image
FROM node:20-alpine

# Enable pnpm via corepack (comes with Node 20)
RUN corepack enable && corepack prepare pnpm@10.22.0 --activate

# Set working directory
WORKDIR /app

# Copy package files first (for better Docker layer caching)
COPY package.json pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --no-frozen-lockfile

# Copy the rest of the application files
COPY . .

# Expose port (Railway will use PORT env var, default to 4000)
EXPOSE ${PORT:-4000}

# Start the application
CMD ["node", "index.js"]

