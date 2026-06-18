export const JBI_CONFIG = new URL(
  "https://raw.githubusercontent.com/mozilla/jira-bugzilla-integration/refs/heads/main/config/config.prod.yaml",
);

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
