#!/bin/bash
set -e

# Colors for output
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}Running all Go tests (pkg/...) with fts5 tag...${NC}"

# Run tests with fts5 tag as required for sqlite3
go test --tags fts5 ./pkg/...
