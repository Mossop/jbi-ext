import { JiraMap } from "./config";
import { addMessageListener, LinkDiscovered, sendMessage } from "./ipc";

const GraphQLEndpoint = "/rest/graphql/1/";
const GiraEndpoint = "/rest/gira/1/";

const jiraId = `
  query issueFields($issueKey: String!) {
    issue(issueIdOrKey: $issueKey, latestVersion: true, screen: "view") {
     id
    }
  }
`;

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
  let response = await content.fetch(endpoint, {
    method: "POST",
    mode: "same-origin",
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

async function fetchJiraId(
  page: URL,
  project: string,
  id: string
): Promise<string> {
  let data = await graphql(new URL(GraphQLEndpoint, page), jiraId, {
    issueKey: `${project}-${id}`,
  });

  return data.issue.id;
}

let project: string | undefined = undefined;
let id: string | undefined = undefined;

function findBugLink(links: Record<string, string>, bugzilla: URL): URL | null {
  for (let href of Object.values(links)) {
    let bug = new URL(href);
    if (bug.origin == bugzilla.origin && bug.pathname == "/show_bug.cgi") {
      return bug;
    }
  }

  return null;
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

  [, project, id] = matches;
  if (!project || !id) {
    return;
  }

  let fields = await fetchJiraFields(url, project, id);
  if (!fields.summary) {
    console.warn(`Unknown summary for issue ${project}-${id}`);
    return;
  }
  let links = await fetchJiraWebLinks(url, project, id);

  let bug = findBugLink(links, bugzilla);
  let jira = new URL(`/browse/${project}-${id}`, url);

  sendMessage("discovery", {
    source: "jira",
    jira: jira.toString(),
    project,
    id,
    summary: fields.summary,
    bug: bug?.href ?? null,
  });
}

addMessageListener("link", async (link: LinkDiscovered) => {
  if (!project || !id) {
    return;
  }

  let jira = new URL(`/browse/${project}-${id}`, window.location.href);
  if (link.jira != jira.toString()) {
    return;
  }

  let bugzilla = JiraMap.get(jira.origin);
  if (!bugzilla) {
    console.warn(`No known Bugzilla for ${jira.origin}`);
    return;
  }

  let links = await fetchJiraWebLinks(jira, project, id);
  let bug = findBugLink(links, bugzilla);

  if (bug) {
    return;
  }

  let icon = new URL("/favicon.ico", link.bug);
  let internalId = await fetchJiraId(jira, project, id);
  let remoteLink = new URL(`/rest/api/3/issue/${internalId}/remotelink`, jira);

  let response = await content.fetch(remoteLink, {
    method: "POST",
    mode: "cors",
    referrerPolicy: "origin-when-cross-origin",
    headers: {
      "Content-Type": "application/json",
      Origin: jira.origin,
    },
    body: JSON.stringify({
      object: {
        icon: { url16x16: icon.toString() },
        title: "Bugzilla Ticket",
        url: link.bug,
      },
    }),
  });

  if (response.ok) {
    window.location.reload();
  }
});

parseData();
