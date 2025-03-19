import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, copyFileSync } from 'fs';
import { join, dirname } from 'path';

// Create backups directory if it doesn't exist
const BACKUPS_DIR = join(process.cwd(), 'backups');
if (!existsSync(BACKUPS_DIR)) {
  mkdirSync(BACKUPS_DIR);
}

// Files and directories to exclude from backup
const EXCLUDE_LIST = [
  'node_modules',
  'dist',
  '.git',
  'backups'
];

// Recursively copy directory
const copyDir = (src, dest) => {
  // Create destination directory
  if (!existsSync(dest)) {
    mkdirSync(dest, { recursive: true });
  }

  // Read directory contents
  const entries = readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    // Skip excluded files and directories
    if (EXCLUDE_LIST.includes(entry.name)) {
      continue;
    }

    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
};

// Create backup with timestamp
const createBackup = () => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = join(BACKUPS_DIR, timestamp);
  
  try {
    // Create backup directory
    mkdirSync(backupDir);

    // Backup project root
    const projectRoot = process.cwd();
    console.log('Creating full project backup...');
    
    // Copy all files and directories except excluded ones
    const entries = readdirSync(projectRoot, { withFileTypes: true });
    for (const entry of entries) {
      if (EXCLUDE_LIST.includes(entry.name)) {
        continue;
      }

      const srcPath = join(projectRoot, entry.name);
      const destPath = join(backupDir, entry.name);

      if (entry.isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        copyFileSync(srcPath, destPath);
      }
    }

    // Create metadata file
    const metadata = {
      timestamp,
      createdAt: new Date().toISOString(),
      files: readdirSync(backupDir, { recursive: true })
    };

    writeFileSync(
      join(backupDir, 'backup-metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    console.log(`Backup created successfully in ${backupDir}`);
    console.log(`Total files backed up: ${metadata.files.length}`);
  } catch (error) {
    console.error('Error creating backup:', error);
  }
};

// Restore from backup
const restoreBackup = (timestamp) => {
  const backupDir = join(BACKUPS_DIR, timestamp);
  
  if (!existsSync(backupDir)) {
    console.error(`Backup ${timestamp} not found`);
    return;
  }

  try {
    console.log('Restoring project backup...');
    const projectRoot = process.cwd();
    
    // Copy all files and directories from backup
    const entries = readdirSync(backupDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === 'backup-metadata.json') {
        continue;
      }

      const srcPath = join(backupDir, entry.name);
      const destPath = join(projectRoot, entry.name);

      if (entry.isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        copyFileSync(srcPath, destPath);
      }
    }

    // Read and display metadata
    const metadataPath = join(backupDir, 'backup-metadata.json');
    if (existsSync(metadataPath)) {
      const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
      console.log('Backup metadata:');
      console.log(`Created at: ${metadata.createdAt}`);
      console.log(`Files restored: ${metadata.files.length}`);
    }

    console.log(`Restored from backup ${timestamp}`);
  } catch (error) {
    console.error('Error restoring backup:', error);
  }
};

// List available backups
const listBackups = () => {
  try {
    const backups = existsSync(BACKUPS_DIR) ? 
      readdirSync(BACKUPS_DIR) : [];
    
    if (backups.length === 0) {
      console.log('No backups found');
      return;
    }

    console.log('Available backups:');
    backups.forEach(backup => {
      const metadataPath = join(BACKUPS_DIR, backup, 'backup-metadata.json');
      if (existsSync(metadataPath)) {
        const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
        console.log(`\n${backup}`);
        console.log(`Created: ${metadata.createdAt}`);
        console.log(`Files: ${metadata.files.length}`);
      } else {
        console.log(`\n${backup} (no metadata available)`);
      }
    });
  } catch (error) {
    console.error('Error listing backups:', error);
  }
};

// Handle command line arguments
const command = process.argv[2];
const timestamp = process.argv[3];

switch (command) {
  case 'create':
    createBackup();
    break;
  case 'restore':
    if (!timestamp) {
      console.error('Please provide a backup timestamp');
      break;
    }
    restoreBackup(timestamp);
    break;
  case 'list':
    listBackups();
    break;
  default:
    console.log(`
Usage:
  node backup.js create            Create a new backup
  node backup.js restore [backup]  Restore from a backup
  node backup.js list             List available backups
    `);
}