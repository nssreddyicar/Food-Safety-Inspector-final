import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) throw new Error('Token not found');

  const connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    { headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken } }
  ).then(res => res.json()).then(data => data.items?.[0]);

  return connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;
}

const IGNORE_PATTERNS = [
  'node_modules', '.git', '.upm', '.cache', '.config', '.local',
  '.npm', '.nix-defexpr', '.nix-profile', 'dist', 'build',
  '.replit-state', 'attached_assets', '__pycache__',
  'package-lock.json', '.env', '.DS_Store', 'repl_state.bin'
];

function shouldIgnore(filePath: string): boolean {
  return IGNORE_PATTERNS.some(p => filePath.includes(p));
}

function getAllLocalFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  
  for (const file of files) {
    const filePath = path.join(dir, file);
    
    if (shouldIgnore(filePath)) continue;
    
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      getAllLocalFiles(filePath, fileList);
    } else {
      fileList.push(filePath);
    }
  }
  
  return fileList;
}

async function getGitHubFiles(octokit: Octokit, owner: string, repo: string): Promise<Set<string>> {
  const files = new Set<string>();
  
  async function fetchTree(treePath: string = '') {
    try {
      const { data } = await octokit.repos.getContent({
        owner, repo, path: treePath
      });
      
      if (Array.isArray(data)) {
        for (const item of data) {
          if (item.type === 'file') {
            files.add(item.path);
          } else if (item.type === 'dir') {
            await fetchTree(item.path);
          }
        }
      }
    } catch (e) {}
  }
  
  await fetchTree();
  return files;
}

async function main() {
  const owner = 'nssreddyicar';
  const repo = 'Food-Safety-Inspector-final';
  
  console.log('Connecting to GitHub...');
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });

  console.log('Fetching GitHub files...');
  const githubFiles = await getGitHubFiles(octokit, owner, repo);
  console.log(`GitHub has ${githubFiles.size} files\n`);

  console.log('Scanning local files...');
  const localFiles = getAllLocalFiles('.');
  console.log(`Local has ${localFiles.length} files (excluding ignored)\n`);

  const missing: string[] = [];
  const present: string[] = [];

  for (const localFile of localFiles) {
    const relativePath = localFile.startsWith('./') ? localFile.slice(2) : localFile;
    if (githubFiles.has(relativePath)) {
      present.push(relativePath);
    } else {
      missing.push(relativePath);
    }
  }

  console.log('=== MISSING FROM GITHUB ===');
  if (missing.length === 0) {
    console.log('All files are uploaded!');
  } else {
    // Group by folder
    const byFolder: Record<string, string[]> = {};
    for (const f of missing) {
      const folder = path.dirname(f);
      if (!byFolder[folder]) byFolder[folder] = [];
      byFolder[folder].push(path.basename(f));
    }
    
    for (const [folder, files] of Object.entries(byFolder)) {
      console.log(`\n${folder}/`);
      for (const f of files.slice(0, 10)) {
        console.log(`  - ${f}`);
      }
      if (files.length > 10) {
        console.log(`  ... and ${files.length - 10} more`);
      }
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Present on GitHub: ${present.length}`);
  console.log(`Missing from GitHub: ${missing.length}`);
}

main().catch(console.error);
