const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');
const pkg = require('../package.json');

const binaryName = process.platform === 'win32' ? 'ihpp.exe' : 'ihpp';
const binDir = path.join(__dirname, '../bin');
const binaryPath = path.join(binDir, binaryName);

// Ensure bin directory exists
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

// Map Node.js platform/arch to Go-style (matching GitHub release naming)
const platformMap = {
  darwin: 'darwin',
  linux: 'linux',
  win32: 'windows',
};

const archMap = {
  x64: 'amd64',
  arm64: 'arm64',
};

const os = platformMap[process.platform];
const arch = archMap[process.arch];

if (!os || !arch) {
  console.error(`Unsupported platform or architecture: ${process.platform}/${process.arch}`);
  process.exit(1);
}

const version = pkg.version;
// Release artifacts named like: inspect-http-proxy-plus-linux-amd64.tar.gz
const tarballName = `inspect-http-proxy-plus-${os}-${arch}.tar.gz`;
const url = `https://github.com/liyu1981/inspect-http-proxy-plus/releases/download/v${version}/${tarballName}`;

console.log(`Downloading binary from: ${url}`);

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        download(response.headers.location, dest).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download binary: HTTP ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(resolve);
      });
    }).on('error', (err) => {
      fs.unlink(dest, () => {});
      reject(err);
    });
  });
}

async function main() {
  const tmpTarball = path.join(binDir, tarballName);
  try {
    await download(url, tmpTarball);
    console.log('Download complete, extracting...');

    // Use tar command for extraction (common on most systems)
    execSync(`tar -xzf "${tmpTarball}" -C "${binDir}"`);
    
    // Clean up tarball
    fs.unlinkSync(tmpTarball);

    // Set executable permissions (if not windows)
    if (process.platform !== 'win32') {
      fs.chmodSync(binaryPath, 0o755);
    }
    
    console.log(`Binary installed to: ${binaryPath}`);
  } catch (err) {
    console.error('Error installing binary:', err.message);
    process.exit(1);
  }
}

main();
