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

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function uploadFiles() {
  const owner = 'nssreddyicar';
  const repo = 'Food-Safety-Inspector-final';
  const scriptsDir = 'scripts';
  
  console.log('Connecting to GitHub...');
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });

  const files = fs.readdirSync(scriptsDir).filter(f => 
    f.endsWith('.js') || f.endsWith('.ts')
  );

  console.log(`Found ${files.length} files in scripts/\n`);

  for (const file of files) {
    const filePath = path.join(scriptsDir, file);
    
    try {
      const content = fs.readFileSync(filePath);
      
      let sha: string | undefined;
      try {
        const { data } = await octokit.repos.getContent({ owner, repo, path: filePath });
        sha = (data as any).sha;
      } catch (e) {}

      await octokit.repos.createOrUpdateFileContents({
        owner,
        repo,
        path: filePath,
        message: `Add/update ${filePath}`,
        content: content.toString('base64'),
        sha
      });
      
      console.log(`Uploaded: ${file}`);
      await sleep(500);
    } catch (err: any) {
      console.log(`Failed: ${file} - ${err.message?.substring(0, 60)}`);
    }
  }
  
  console.log('\nDone! View at: https://github.com/' + owner + '/' + repo + '/tree/main/scripts');
}

uploadFiles().catch(console.error);
