#!/usr/bin/env node

const path = require('path');
const { spawnSync } = require('child_process');
const fs = require('fs');

const binaryName = process.platform === 'win32' ? 'ihpp.exe' : 'ihpp';
const binaryPath = path.join(__dirname, binaryName);

// Check if binary exists
if (!fs.existsSync(binaryPath)) {
  console.error(`Binary not found at: ${binaryPath}.`);
  console.error('It should have been downloaded during postinstall. Try reinstalling the package.');
  process.exit(1);
}

// Forward all arguments and run the native binary
const result = spawnSync(binaryPath, process.argv.slice(2), {
  stdio: 'inherit',
  shell: false,
});

if (result.error) {
  console.error('Error executing native binary:', result.error.message);
  process.exit(1);
}

process.exit(result.status);
