import { Octokit } from '@octokit/rest';

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

async function checkRepo() {
  const owner = 'nssreddyicar';
  const repo = 'Food-Safety-Inspector-final';
  
  console.log('Checking GitHub repository...\n');
  
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });

  // Get repo info
  const { data: repoData } = await octokit.repos.get({ owner, repo });
  console.log('Repository:', repoData.full_name);
  console.log('Size:', (repoData.size / 1024).toFixed(2), 'MB');
  console.log('Default branch:', repoData.default_branch);
  console.log('Created:', repoData.created_at);
  console.log('Updated:', repoData.updated_at);
  
  // Get latest commits
  const { data: commits } = await octokit.repos.listCommits({ owner, repo, per_page: 5 });
  console.log('\nRecent commits:');
  commits.forEach((c, i) => {
    console.log(`  ${i+1}. ${c.commit.message.substring(0, 60)}`);
  });

  // Count files in key directories
  console.log('\nDirectory contents:');
  const dirs = ['', 'server', 'client', 'android-app', 'shared', 'android-app/lib'];
  
  for (const dir of dirs) {
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path: dir || '' });
      if (Array.isArray(data)) {
        const files = data.filter(d => d.type === 'file').length;
        const folders = data.filter(d => d.type === 'dir').length;
        console.log(`  /${dir || '(root)'}: ${files} files, ${folders} folders`);
      }
    } catch (e) {
      console.log(`  /${dir}: not found`);
    }
  }
  
  console.log('\n✓ Repository URL: https://github.com/' + owner + '/' + repo);
}

checkRepo().catch(console.error);
