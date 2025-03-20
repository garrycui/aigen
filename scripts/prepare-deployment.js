import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const sharedDistDir = path.join(rootDir, 'packages/shared/dist');
const webDistDir = path.join(rootDir, 'packages/web/dist');

// Create dist directory if it doesn't exist
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir);
}

// Copy server files
console.log('Copying server files...');
fs.cpSync(sharedDistDir, distDir, { recursive: true });

// Copy web files
console.log('Copying web files...');
fs.cpSync(webDistDir, distDir, { recursive: true });

// Create package.json for deployment
console.log('Creating deployment package.json...');
const packageJson = {
  "name": "aigen-deploy",
  "version": "1.0.0",
  "private": true,
  "engines": {
    "node": ">=18.0.0"
  },
  "scripts": {
    "start": "node server/server.js"
  },
  "dependencies": {
    "express": "^4.21.2",
    "firebase": "^11.5.0",
    "stripe": "^17.7.0",
    "node-cron": "^3.0.3",
    "openai": "^4.89.0",
    "axios": "^1.8.4",
    "dotenv": "^16.4.7"
  }
};

fs.writeFileSync(
  path.join(distDir, 'package.json'),
  JSON.stringify(packageJson, null, 2)
);

// Copy app.yaml
console.log('Copying app.yaml...');
fs.copyFileSync(path.join(rootDir, 'app.yaml'), path.join(distDir, 'app.yaml'));

console.log('Deployment preparation complete!');