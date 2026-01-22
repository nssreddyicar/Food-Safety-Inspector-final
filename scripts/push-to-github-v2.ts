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

async function pushToGitHub() {
  const owner = 'nssreddyicar';
  const repo = 'Food-Safety-Inspector-final';
  
  console.log('Connecting to GitHub...');
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });
  
  // First, create initial commit with README to initialize the repo
  console.log('Initializing repository with README...');
  try {
    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: 'README.md',
      message: 'Initial commit - Food Safety Inspector',
      content: Buffer.from(`# Food Safety Inspector

Government-grade FSSAI regulatory system for food safety officers.

## Features
- Inspection management
- Sample tracking with chain-of-custody
- Complaint management
- Court case tracking
- Analytics dashboard
- Data export (CSV/JSON)

## Tech Stack
- Backend: Express.js + PostgreSQL
- Mobile: Flutter (production) + Expo (development)
- Admin: HTML templates

## Setup
1. Clone the repository
2. Run \`npm install\`
3. Set up PostgreSQL database
4. Run \`npm run dev\`
`).toString('base64')
    });
    console.log('README created successfully');
  } catch (e: any) {
    if (e.status === 422) {
      console.log('README already exists, updating...');
      const { data: existing } = await octokit.repos.getContent({ owner, repo, path: 'README.md' });
      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: 'README.md',
        message: 'Update README',
        content: Buffer.from('# Food Safety Inspector\n\nGovernment-grade FSSAI regulatory system.').toString('base64'),
        sha: (existing as any).sha
      });
    }
  }

  await sleep(2000);

  // Get important files to upload
  const importantFiles = [
    'package.json',
    'tsconfig.json',
    'shared/schema.ts',
    'server/index.ts',
    'server/routes.ts',
    'server/db.ts',
    'replit.md'
  ];

  console.log('Uploading key files...');
  for (const filePath of importantFiles) {
    try {
      const fullPath = path.join(process.cwd(), filePath);
      if (!fs.existsSync(fullPath)) continue;
      
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
      
      console.log(`Uploaded: ${filePath}`);
      await sleep(1000); // Rate limit friendly
    } catch (err: any) {
      console.error(`Failed: ${filePath} - ${err.message}`);
    }
  }

  console.log('\n✓ Repository initialized with key files!');
  console.log(`\nView at: https://github.com/${owner}/${repo}`);
  console.log('\nNote: For full upload, use Replit Git pane (left sidebar) to push all files.');
}

pushToGitHub().catch(console.error);
