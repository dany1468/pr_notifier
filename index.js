require('dotenv').config();

const {IncomingWebhook} = require('@slack/client');
const slack_url = process.env.SLACK_WEBHOOK_URL;
const webhook = new IncomingWebhook(slack_url);
const octokit = require('@octokit/rest')();
const github_token = process.env.GITHUB_TOKEN;

octokit.authenticate({
  type: 'token',
  token: github_token
});

const parseIssueURL = (url) => {
  const match = url.match('https://api.github.com/repos/(.*)/(.*)/issues/(.*)');
  if (match === null) {
    return {};
  } else {
    return {
      owner: match[1],
      repo: match[2],
      number: match[3]
    };
  }
};

async function asyncMap(array, operation) {
  return Promise.all(array.map(async item => await operation(item)));
}

async function fetchApprovedReviews(pr) {
  const parsed = parseIssueURL(pr.url);

  const result = await octokit.pullRequests.getReviews({owner: parsed.owner, repo: parsed.repo, number: parsed.number});

  return result.data.filter(review => review.state === 'APPROVED');
}

async function main() {
  const issues = await octokit.search.issues({q: process.env.QUERY_FOR_SEARCHING_ISSUES, sort: 'created', order: 'asc'});

  if (issues.data.total_count = 0) return [];

  const notifyingContents = await asyncMap(issues.data.items, async pr => {
    const approvedReviews = await fetchApprovedReviews(pr);

    return {
      pr: pr,
      approved: approvedReviews.map(review => {
        return {user: review.user.login}
      })
    }
  });

  const message = notifyingContents.map(c => {
    const parsed = parseIssueURL(c.pr.url);

    return {
      title: `${c.pr.title} ( ${parsed.repo} #${parsed.number} )`,
      title_link: c.pr.html_url,
      fields: [{
        title: ':clap: レビュー :sumi:',
        value: c.approved.length > 0 ? c.approved.map(a => a.user).join(", ") : 'まだレビュー完了してる人はいないよ'
      }]
    }
  });

  webhook.send({text: '<!here> アクティブな PR です。お手すきでレビューをお願いしますー :pray:', attachments: message});
}

main()
  .then(_ => console.log('Success!'))
  .catch(err => console.error(err));
