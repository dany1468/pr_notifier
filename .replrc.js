require('dotenv').config();

const github_token = process.env.GITHUB_TOKEN;
const octokit = require('@octokit/rest')();

octokit.authenticate({
  type: 'token',
  token: github_token
});

module.exports = {
  enableAwait: true
}

module.exports = {context: {octokit:octokit}};
