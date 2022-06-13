import browser, { Runtime } from "webextension-polyfill";

export interface BugzillaMessage {
  source: "bugzilla";
  page: string;
  id: string;
  jira: string | null;
}

export interface JiraMessage {
  source: "jira";
  page: string;
  project: string;
  id: string;
  summary: string;
  bug: string | null;
}

export type TabMessage = BugzillaMessage | JiraMessage;

export function sendMessage(message: TabMessage) {
  browser.runtime.sendMessage(message);
}

export function addMessageListener(
  listener: (message: TabMessage, sender: Runtime.MessageSender) => void
) {
  browser.runtime.onMessage.addListener(listener);
}
