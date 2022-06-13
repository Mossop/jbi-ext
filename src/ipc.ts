import browser, { Runtime } from "webextension-polyfill";

export interface BugzillaMessage {
  source: "bugzilla";
  id: string;
  jiraIssue: string | undefined;
}

export type TabMessage = BugzillaMessage;

export function sendMessage(message: TabMessage) {
  browser.runtime.sendMessage(message);
}

export function addMessageListener(
  listener: (message: TabMessage, sender: Runtime.MessageSender) => void
) {
  browser.runtime.onMessage.addListener(listener);
}
