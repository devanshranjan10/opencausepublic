#!/bin/bash

# Production Build Script for OpenCause
# This script builds all packages and applications for production

set -e

echo "🚀 Building OpenCause for Production..."
echo ""

# Build shared packages first
echo "📦 Building shared packages..."
npx pnpm --filter @opencause/types build
npx pnpm --filter @opencause/policy build

# Build backend
echo "🔧 Building backend API..."
npx pnpm --filter api build

# Build frontend
echo "🎨 Building frontend..."
NODE_ENV=production npx pnpm --filter web build

echo ""
echo "✅ Production build complete!"
echo ""
echo "📁 Output locations:"
echo "  - Backend: apps/api/dist"
echo "  - Frontend: apps/web/.next"
echo ""
echo "🚀 To start production servers:"
echo "  - Backend: npx pnpm --filter api start:prod"
echo "  - Frontend: npx pnpm --filter web start"

