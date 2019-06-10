require('dotenv').config();

const github_token = process.env.GITHUB_TOKEN;
const Octokit = require('@octokit/rest');

const octokit = new Octokit({
  auth: 'token ' + github_token
});

module.exports = {
  enableAwait: true
}

module.exports = {context: {octokit:octokit}};
