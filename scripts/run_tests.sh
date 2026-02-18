#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}Running all Go tests (pkg/...) with fts5 tag...${NC}"

# Ensure embedded UI files exist or go build/test will fail
if [ ! -d "pkg/web/ui/out" ]; then
    echo -e "\033[0;31mError: pkg/web/ui/out directory is missing.\033[0m"
    echo "Please run './scripts/build_and_copy_frontend.sh' first to generate the embedded frontend files."
    exit 1
fi

# Run tests with fts5 tag as required for sqlite3
go test --tags fts5 ./pkg/...
