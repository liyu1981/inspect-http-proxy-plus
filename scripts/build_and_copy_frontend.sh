#!/bin/bash

cd frontend
pnpm build
rm -rf ../pkg/web/ui/out/*
cp -r ./out/* ../pkg/web/ui/out/
cd -