import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

async function getGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = [], basePath: string = dirPath): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    const relativePath = path.relative(basePath, fullPath);
    
    // Skip these directories/files
    if (file === 'node_modules' || file === '.git' || file === '.cache' || 
        file === '.local' || file === '.upm' || file === '.config' ||
        file.startsWith('.replit') || file === 'replit.nix' ||
        file === '.breakpoints' || file === 'package-lock.json') {
      return;
    }

    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles, basePath);
    } else {
      arrayOfFiles.push(relativePath);
    }
  });

  return arrayOfFiles;
}

async function pushToGitHub() {
  const owner = 'nssreddyicar';
  const repo = 'Food-Safety-Inspector-final';
  
  console.log('Connecting to GitHub...');
  const octokit = await getGitHubClient();
  
  console.log('Getting authenticated user...');
  const { data: user } = await octokit.users.getAuthenticated();
  console.log(`Authenticated as: ${user.login}`);

  // Get all files
  console.log('Collecting files...');
  const projectPath = process.cwd();
  const files = getAllFiles(projectPath);
  console.log(`Found ${files.length} files to upload`);

  // Get or create the main branch
  let sha: string | undefined;
  try {
    const { data: ref } = await octokit.git.getRef({
      owner,
      repo,
      ref: 'heads/main'
    });
    sha = ref.object.sha;
    console.log('Found existing main branch');
  } catch (e) {
    console.log('Main branch does not exist, will create it');
  }

  // Create blobs for each file
  console.log('Uploading files...');
  const tree: { path: string; mode: '100644'; type: 'blob'; sha: string }[] = [];
  
  let uploaded = 0;
  for (const filePath of files) {
    try {
      const fullPath = path.join(projectPath, filePath);
      const content = fs.readFileSync(fullPath);
      const base64Content = content.toString('base64');
      
      const { data: blob } = await octokit.git.createBlob({
        owner,
        repo,
        content: base64Content,
        encoding: 'base64'
      });
      
      tree.push({
        path: filePath,
        mode: '100644',
        type: 'blob',
        sha: blob.sha
      });
      
      uploaded++;
      if (uploaded % 50 === 0) {
        console.log(`Uploaded ${uploaded}/${files.length} files...`);
      }
    } catch (err: any) {
      console.error(`Failed to upload ${filePath}: ${err.message}`);
    }
  }
  
  console.log(`Uploaded ${uploaded} files`);

  // Create tree
  console.log('Creating commit tree...');
  const { data: newTree } = await octokit.git.createTree({
    owner,
    repo,
    tree,
    base_tree: sha
  });

  // Create commit
  console.log('Creating commit...');
  const { data: commit } = await octokit.git.createCommit({
    owner,
    repo,
    message: 'Food Safety Inspector - Complete App Upload',
    tree: newTree.sha,
    parents: sha ? [sha] : []
  });

  // Update or create ref
  console.log('Updating branch reference...');
  try {
    await octokit.git.updateRef({
      owner,
      repo,
      ref: 'heads/main',
      sha: commit.sha,
      force: true
    });
  } catch (e) {
    await octokit.git.createRef({
      owner,
      repo,
      ref: 'refs/heads/main',
      sha: commit.sha
    });
  }

  console.log('');
  console.log('SUCCESS! Your code has been pushed to:');
  console.log(`https://github.com/${owner}/${repo}`);
}

pushToGitHub().catch(console.error);
