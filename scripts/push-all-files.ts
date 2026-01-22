import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

let connectionSettings: any;

async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) throw new Error('Token not found');

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    { headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken } }
  ).then(res => res.json()).then(data => data.items?.[0]);

  return connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getAllFiles(dirPath: string, basePath: string = dirPath): string[] {
  const result: string[] = [];
  const items = fs.readdirSync(dirPath);

  for (const item of items) {
    const fullPath = path.join(dirPath, item);
    const relativePath = path.relative(basePath, fullPath);

    // Skip these
    if (item === 'node_modules' || item === '.git' || item === '.cache' || 
        item === '.local' || item === '.upm' || item === '.config' ||
        item.startsWith('.replit') || item === '.breakpoints' ||
        item === 'package-lock.json' || item === 'static-build' ||
        item === '.npm' || item === '.pnpm-store') {
      continue;
    }

    if (fs.statSync(fullPath).isDirectory()) {
      result.push(...getAllFiles(fullPath, basePath));
    } else {
      result.push(relativePath);
    }
  }

  return result;
}

async function pushToGitHub() {
  const owner = 'nssreddyicar';
  const repo = 'Food-Safety-Inspector-final';
  
  console.log('Connecting to GitHub...');
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });

  // Get all files
  const projectPath = process.cwd();
  const allFiles = getAllFiles(projectPath);
  console.log(`Found ${allFiles.length} files to upload`);

  // Upload in batches with delays
  let uploaded = 0;
  let failed = 0;

  for (const filePath of allFiles) {
    try {
      const fullPath = path.join(projectPath, filePath);
      const stat = fs.statSync(fullPath);
      
      // Skip large files (> 1MB)
      if (stat.size > 1000000) {
        console.log(`Skipping large file: ${filePath} (${(stat.size/1024/1024).toFixed(2)}MB)`);
        continue;
      }

      const content = fs.readFileSync(fullPath);
      
      // Check if file exists
      let sha: string | undefined;
      try {
        const { data } = await octokit.repos.getContent({ owner, repo, path: filePath });
        sha = (data as any).sha;
      } catch (e) {}

      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: filePath,
        message: `Add ${filePath}`,
        content: content.toString('base64'),
        sha
      });
      
      uploaded++;
      if (uploaded % 10 === 0) {
        console.log(`Progress: ${uploaded}/${allFiles.length} files uploaded`);
      }
      
      // Rate limit friendly - wait between uploads
      await sleep(500);
    } catch (err: any) {
      if (err.message?.includes('rate limit')) {
        console.log('Rate limit hit, waiting 60 seconds...');
        await sleep(60000);
        // Retry this file
        try {
          const fullPath = path.join(projectPath, filePath);
          const content = fs.readFileSync(fullPath);
          await octokit.repos.createOrUpdateFileContents({
            owner,
            repo,
            path: filePath,
            message: `Add ${filePath}`,
            content: content.toString('base64')
          });
          uploaded++;
        } catch (e) {
          failed++;
        }
      } else {
        failed++;
        if (failed < 5) {
          console.log(`Failed: ${filePath} - ${err.message?.substring(0, 50)}`);
        }
      }
    }
  }

  console.log('');
  console.log(`Upload complete: ${uploaded} files uploaded, ${failed} failed`);
  console.log(`View at: https://github.com/${owner}/${repo}`);
}

pushToGitHub().catch(console.error);
