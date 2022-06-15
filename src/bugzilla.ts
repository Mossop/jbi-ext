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

function parseBugData(url: URL, jira: URL) {
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

function fixCreatePage(url: URL) {
  // Work around https://bugzilla.mozilla.org/show_bug.cgi?id=1774403.
  let additionalParams: Record<string, string> = {};

  for (let param of ["short_desc", "status_whiteboard", "see_also"]) {
    if (url.searchParams.has(param)) {
      additionalParams[param] = url.searchParams.get(param)!;
    } else {
      return;
    }
  }

  let anchors = document.querySelectorAll(
    "#product-list th a[href^='/enter_bug.cgi?product=']"
  );

  anchors.forEach((anchor) => {
    let href = anchor.getAttribute("href");
    if (!href) {
      return;
    }

    let hrefUrl = new URL(href, url);
    // Append the parameters we want to the links.
    for (let [param, value] of Object.entries(additionalParams)) {
      hrefUrl.searchParams.set(param, value);
    }

    // Strip the origin from the link.
    let relativeLink = hrefUrl.toString().substring(url.origin.length);
    anchor.setAttribute("href", relativeLink);
  });
}

function init() {
  let url = new URL(window.location.href);

  let jira = BzMap.get(url.origin);
  if (!jira) {
    console.warn(`No known Jira for ${url.origin}`);
    return;
  }

  if (url.pathname == "/show_bug.cgi") {
    parseBugData(url, jira);
    return;
  }

  if (url.pathname == "/enter_bug.cgi" && !url.searchParams.has("product")) {
    fixCreatePage(url);
    return;
  }
}

init();
