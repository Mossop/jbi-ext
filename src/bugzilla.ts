import { BzMap } from "./config";
import { sendMessage } from "./ipc";

function parseJiraIssue(jira: URL, href: string | undefined): URL | null {
  if (!href) {
    return null;
  }

  let url = new URL(href);
  if (url.origin == jira.origin) {
    return url;
  }

  return null;
}

function parseData() {
  let url = new URL(window.location.href);

  let jira = BzMap.get(url.origin);
  if (!jira) {
    console.warn(`No known Jira for ${url.origin}`);
    return;
  }

  if (url.pathname != "/show_bug.cgi") {
    return;
  }

  let id = url.searchParams.get("id");
  if (!id) {
    return;
  }

  let jiraIssue = parseJiraIssue(
    jira,
    document.querySelector<HTMLAnchorElement>("#field-value-see_also a")?.href
  );

  let bug = new URL("/show_bug.cgi", url);
  bug.searchParams.set("id", id);

  sendMessage("discovery", {
    source: "bugzilla",
    bug: bug.toString(),
    id,
    jira: jiraIssue?.href ?? null,
  });
}

parseData();
