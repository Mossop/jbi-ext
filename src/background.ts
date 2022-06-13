import browser, { PageAction, Runtime, Tabs } from "webextension-polyfill";
import { addMessageListener, TabMessage } from "./ipc";

interface LinkedBug {
  type: "linked-bug";
  id: string;
  jiraIssue: URL;
  icon: string;
  title: string;
}

interface UnlinkedBug {
  type: "unlinked-bug";
  id: string;
  icon: string;
  title: string;
}

type TabContent = LinkedBug | UnlinkedBug | undefined;

const TabMap = new Map<number, TabContent>();

function contentFromMessage(message: TabMessage): TabContent {
  if (message.source == "bugzilla") {
    if (message.jiraIssue) {
      return {
        type: "linked-bug",
        id: message.id,
        jiraIssue: new URL(message.jiraIssue),
        title: "Open Jira Issue",
        icon: "jira.ico",
      };
    }
  }

  return undefined;
}

function openPage(
  url: URL,
  openerTabId: number | undefined,
  modifiers: PageAction.OnClickDataModifiersItemEnum[]
) {
  browser.tabs.create({
    openerTabId,
    url: url.toString(),
  });
}

function onPageActionClicked(
  tab: Tabs.Tab,
  clickData: PageAction.OnClickData | undefined
) {
  if (!clickData) {
    return;
  }

  let { button, modifiers } = clickData;

  if (button != 0 || !tab.id) {
    return;
  }

  let content = TabMap.get(tab.id);
  if (!content) {
    return;
  }

  switch (content.type) {
    case "linked-bug": {
      openPage(content.jiraIssue, tab.id, modifiers);
      break;
    }
  }
}

function onMessage(message: TabMessage, sender: Runtime.MessageSender) {
  let tabId = sender.tab?.id;
  if (!tabId) {
    return;
  }

  let content = contentFromMessage(message);
  if (content) {
    browser.pageAction.setTitle({
      tabId,
      title: content.title,
    });
    browser.pageAction.setIcon({
      tabId,
      path: `icons/${content.icon}`,
    });
    browser.pageAction.show(tabId);
  } else {
    browser.pageAction.hide(tabId);
  }

  TabMap.set(tabId, content);
}

addMessageListener(onMessage);

browser.tabs.onReplaced.addListener((addedTabId, removedTabId) => {
  TabMap.delete(removedTabId);
});

browser.tabs.onRemoved.addListener((removedTabId) =>
  TabMap.delete(removedTabId)
);

browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.url) {
    browser.pageAction.hide(tabId);
    TabMap.delete(tabId);
  }
});

browser.pageAction.onClicked.addListener(onPageActionClicked);
