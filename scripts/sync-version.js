const fs = require('fs');
const path = require('path');

const constantsPath = path.join(__dirname, '../pkg/core/constants.go');
const packageJsonPath = path.join(__dirname, '../package.json');

function syncVersion() {
  try {
    const constantsContent = fs.readFileSync(constantsPath, 'utf8');
    const versionMatch = constantsContent.match(/const Version = "([^"]+)"/);
    
    if (!versionMatch) {
      console.error('Could not find Version constant in pkg/core/constants.go');
      process.exit(1);
    }
    
    const version = versionMatch[1];
    if (version === 'dev') {
      console.log('Backend version is "dev", skipping sync.');
      return;
    }

    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    if (pkg.version !== version) {
      console.log(`Syncing package.json version: ${pkg.version} -> ${version}`);
      pkg.version = version;
      fs.writeFileSync(packageJsonPath, JSON.stringify(pkg, null, 2) + '
');
    } else {
      console.log(`Versions already match: ${version}`);
    }
  } catch (err) {
    console.error('Error syncing version:', err.message);
    process.exit(1);
  }
}

syncVersion();
