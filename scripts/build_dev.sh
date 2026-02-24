#!/bin/bash

./scripts/build_and_copy_frontend.sh
go build -tags fts5 -o ihpp ./cmd/proxy/main.go
