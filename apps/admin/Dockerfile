# Use Node 18
FROM node:18-alpine

# Set working directory to the container root
WORKDIR /app

# Install PNPM
RUN npm install -g pnpm

# Copy ALL files from your project into the container
COPY . .

# Install dependencies (from the root)
RUN pnpm install --frozen-lockfile

# Build ONLY the admin app
RUN cd apps/admin && pnpm run build

# Install 'serve' to run the website
RUN npm install -g serve

# Serve the specific admin build folder
CMD ["serve", "-s", "apps/admin/dist", "-l", "8080"]