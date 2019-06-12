require('dotenv').config();

const {IncomingWebhook} = require('@slack/client');
const slack_url = process.env.SLACK_WEBHOOK_URL;
const webhook = new IncomingWebhook(slack_url);
const Octokit = require('@octokit/rest');
const github_token = process.env.GITHUB_TOKEN;

const octokit = new Octokit({
  auth: 'token ' + github_token
});

const parseIssueURL = (url) => {
  const match = url.match('https://api.github.com/repos/(.*)/(.*)/issues/(.*)');
  if (match === null) {
    return {};
  } else {
    return {
      owner: match[1],
      repo: match[2],
      pull_number: match[3]
    };
  }
};

async function asyncMap(array, operation) {
  return Promise.all(array.map(async item => await operation(item)));
}

async function sleep(msec) {
  return new Promise(resolve => setTimeout(resolve, msec));
}

async function fetchReviews(pr) {
  const parsed = parseIssueURL(pr.url);

  const result = await octokit.pullRequests.listReviews({owner: parsed.owner, repo: parsed.repo, pull_number: parsed.pull_number});

  return result.data.filter(review => review.state === 'APPROVED' ||  review.state === 'CHANGES_REQUESTED' ||  review.state === 'COMMENTED');
}

async function main() {
  const separatePost = process.argv.slice(2).includes('-separate');

  const issues = await octokit.search.issuesAndPullRequests({q: process.env.QUERY_FOR_SEARCHING_ISSUES, sort: 'created', order: 'asc'});

  if (issues.data.total_count = 0) return [];

  const notifyingContents = await asyncMap(issues.data.items, async pr => {
    const reviews = await fetchReviews(pr);

    return {
      pr: pr,
      approved: reviews.filter(review => review.state === 'APPROVED').map(review => {
        return {user: review.user.login}
      }),
      requested: reviews.filter(review => review.state === 'CHANGES_REQUESTED').map(review => {
        return {user: review.user.login}
      }),
      commented: reviews.filter(review => review.state === 'COMMENTED').map(review => {
        return {user: review.user.login}
      })
    }
  });

  const message = notifyingContents.map(c => {
    const parsed = parseIssueURL(c.pr.url);

    return {
      title: `${c.pr.title} ( ${parsed.repo} #${parsed.pull_number} )`,
      title_link: c.pr.html_url,
      fields: [{
        title: (c.approved.length >= 2 ? 'Merge :ok_woman:' : ''),
        value: 'Commented: ' + (c.commented.length > 0 ? c.commented.map(a => a.user).filter(function (x, i, self) {return self.indexOf(x) === i;}).join(", ") : 'none')
          + '\nRequested: ' + (c.requested.length > 0 ? c.requested.map(a => a.user).filter(function (x, i, self) {return self.indexOf(x) === i;}).join(", ") : 'none')
          + '\nApproved: ' + (c.approved.length > 0 ? c.approved.map(a => a.user).filter(function (x, i, self) {return self.indexOf(x) === i;}).join(", ") : 'none :fire:')
      }]
    }
  });

  const messages = separatePost ? message.map(m => [m]) : [message];
  for (var i = 0; i < messages.length; i++) {
    if (i > 0) await sleep(1000);
    let text = i == 0 ? '<!here> アクティブな PR です。お手すきでレビューをお願いしますー :pray:' : '';
    webhook.send({text: text, attachments: messages[i]});
  }
}

main()
  .then(_ => console.log('Success!'))
  .catch(err => console.error(err));
