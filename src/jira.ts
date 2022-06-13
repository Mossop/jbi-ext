import { JiraMap } from "./config";
import { sendMessage } from "./ipc";

const GraphQLEndpoint = "/rest/graphql/1/";

const jiraWeblinks = `
  query issueViewRemoteDataQuery($issueKey: String!) {
    issue: viewIssue(issueKey: $issueKey) {
      remoteLinks {
        webLinks(allowThirdParties: true, orderBy: \"-id\") {
          links {
            href
            linkText
          }
        }
      }
    }
  }
`;
interface JiraWebLink {
  href: string;
  linkText: string;
}

async function graphql(
  server: URL,
  query: string,
  variables: Record<string, string> = {}
): Promise<any> {
  let endpoint = new URL(GraphQLEndpoint, server);
  let response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(response.statusText);
  }

  let json = await response.json();
  return json.data;
}

async function fetchJiraWeblinks(
  page: URL,
  project: string,
  id: string
): Promise<JiraWebLink[]> {
  let data = await graphql(page, jiraWeblinks, {
    issueKey: `${project}-${id}`,
  });
  return data.issue.remoteLinks.webLinks.links;
}

async function parseData() {
  let url = new URL(window.location.href);

  let bugzilla = JiraMap.get(url.origin);
  if (!bugzilla) {
    console.warn(`No known Bugzilla for ${url.origin}`);
    return;
  }

  let matches = url.pathname.match(/^\/browse\/(\w+)-(\d+)$/);
  if (!matches) {
    return;
  }

  let [, project, id] = matches;
  if (!project || !id) {
    return;
  }

  let links = await fetchJiraWeblinks(url, project, id);
  for (let link of links) {
    if (link.linkText != "Bugzilla Ticket") {
      continue;
    }

    let bug = new URL(link.href);
    if (bug.origin != bugzilla.origin) {
      continue;
    }

    sendMessage({
      source: "jira",
      project,
      id,
      bug: link.href,
    });

    return;
  }

  sendMessage({
    source: "jira",
    project,
    id,
    bug: null,
  });
}

parseData();
