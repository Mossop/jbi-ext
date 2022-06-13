import { JiraMap } from "./config";
import { sendMessage } from "./ipc";

const GraphQLEndpoint = "/rest/graphql/1/";
const GiraEndpoint = "/rest/gira/1/";

const jiraFields = `
  query issueFields($issueKey: String!) {
    issue(issueIdOrKey: $issueKey, latestVersion: true, screen: "view") {
      fields {
        key
        content
      }
    }
  }
`;

interface JiraField {
  key: string;
  content: string;
}

const jiraWebLinks = `
  query issueWebLinks($issueKey: String!) {
    viewIssue(issueKey: $issueKey) {
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
  endpoint: URL,
  query: string,
  variables: Record<string, string> = {}
): Promise<any> {
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

async function fetchJiraWebLinks(
  page: URL,
  project: string,
  id: string
): Promise<Record<string, string>> {
  let data = await graphql(new URL(GiraEndpoint, page), jiraWebLinks, {
    issueKey: `${project}-${id}`,
  });

  let links: JiraWebLink[] = data.viewIssue.remoteLinks.webLinks.links;
  return Object.fromEntries(
    links.map(({ linkText, href }) => [linkText, href])
  );
}

async function fetchJiraFields(
  page: URL,
  project: string,
  id: string
): Promise<Record<string, string>> {
  let data = await graphql(new URL(GraphQLEndpoint, page), jiraFields, {
    issueKey: `${project}-${id}`,
  });

  let fields: JiraField[] = data.issue.fields;
  return Object.fromEntries(fields.map(({ key, content }) => [key, content]));
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

  let fields = await fetchJiraFields(url, project, id);
  if (!fields.summary) {
    console.warn(`Unknown summary for issue ${project}-${id}`);
    return;
  }
  let links = await fetchJiraWebLinks(url, project, id);

  let bugLink = links["Bugzilla Ticket"] ?? null;
  let bug = bugLink ? new URL(bugLink) : null;
  if (bug?.origin != bugzilla.origin) {
    bug = null;
  }

  sendMessage({
    source: "jira",
    page: url.toString(),
    project,
    id,
    summary: fields.summary,
    bug: bug?.href ?? null,
  });
}

parseData();
