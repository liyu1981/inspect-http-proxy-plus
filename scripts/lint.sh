#!/bin/bash

go fmt ./...
cd frontend
pnpm format
cd -