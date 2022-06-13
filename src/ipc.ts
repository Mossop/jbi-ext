import { Runtime } from "webextension-polyfill";

export interface BugzillaMessage {
  source: "bugzilla";
  bug: string;
  id: string;
  jira: string | null;
}

export interface JiraMessage {
  source: "jira";
  jira: string;
  project: string;
  id: string;
  summary: string;
  bug: string | null;
}

export type TabMessage = BugzillaMessage | JiraMessage;

export interface LinkDiscovered {
  bug: string;
  jira: string;
}

interface IpcChannels {
  discovery: TabMessage;
  link: LinkDiscovered;
}

export function sendMessage<K extends keyof IpcChannels>(
  channel: K,
  message: IpcChannels[K]
) {
  browser.runtime.sendMessage({
    channel,
    message,
  });
}

export function sendTabMessage<K extends keyof IpcChannels>(
  channel: K,
  tabId: number,
  message: IpcChannels[K]
) {
  browser.tabs.sendMessage(tabId, {
    channel,
    message,
  });
}

export function addMessageListener<K extends keyof IpcChannels>(
  channel: K,
  listener: (message: IpcChannels[K], sender: Runtime.MessageSender) => void
) {
  let filter = (message: any, sender: Runtime.MessageSender) => {
    if (message.channel == channel) {
      console.log("onMessage", message.message);
      listener(message.message, sender);
    }
  };

  browser.runtime.onMessage.addListener(filter);
}
