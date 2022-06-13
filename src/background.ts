import browser, { PageAction, Runtime, Tabs } from "webextension-polyfill";
import { addMessageListener, TabMessage } from "./ipc";

interface LinkedBugzilla {
  type: "linked-bugzilla";
  id: string;
  jira: URL;
  icon: string;
  title: string;
}

interface UnlinkedBugzilla {
  type: "unlinked-bugzilla";
  id: string;
  icon: string;
  title: string;
}

interface LinkedJira {
  type: "linked-jira";
  project: string;
  id: string;
  bug: URL;
  icon: string;
  title: string;
}

interface UnlinkedJira {
  type: "unlinked-jira";
  project: string;
  id: string;
  icon: string;
  title: string;
}

type TabContent =
  | LinkedBugzilla
  | UnlinkedBugzilla
  | LinkedJira
  | UnlinkedJira
  | undefined;

const TabMap = new Map<number, TabContent>();

function contentFromMessage(message: TabMessage): TabContent {
  switch (message.source) {
    case "bugzilla": {
      if (message.jira) {
        return {
          type: "linked-bugzilla",
          id: message.id,
          jira: new URL(message.jira),
          title: "Open Jira Issue",
          icon: "jira.ico",
        };
      }
      break;
    }
    case "jira": {
      if (message.bug) {
        return {
          type: "linked-jira",
          project: message.project,
          id: message.id,
          bug: new URL(message.bug),
          title: "Open Bugzilla Bug",
          icon: "bugzilla.ico",
        };
      }
      break;
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
    case "linked-bugzilla": {
      openPage(content.jira, tab.id, modifiers);
      break;
    }
    case "linked-jira": {
      openPage(content.bug, tab.id, modifiers);
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
