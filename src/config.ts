// const JBI = "https://jbi.services.mozilla.com";
const CONFIGS = [
  // Dev
  {
    jira: "https://mozilla-hub-sandbox-721.atlassian.net",
    bugzilla: "https://bugzilla-dev.allizom.org",
  },
  // Prod
  {
    jira: "https://mozilla-hub.atlassian.net",
    bugzilla: "https://bugzilla.mozilla.org",
  },
];

export const JiraMap: Map<string, URL> = new Map<string, URL>();
export const BzMap = new Map<string, URL>();

for (let config of CONFIGS) {
  JiraMap.set(config.jira, new URL(config.bugzilla));
  BzMap.set(config.bugzilla, new URL(config.jira));
}
