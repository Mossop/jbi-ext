import browser, { PageAction, Runtime, Tabs } from "webextension-polyfill";
import { JBI, JiraMap } from "./config";
import { addMessageListener, JiraMessage, TabMessage } from "./ipc";

interface Action {
  project: string;
  whiteboard: string;
}

const TabMap = new Map<number, TabMessage>();
let Actions: Action[] = [];

interface PageActionConfig {
  title: string;
  icon: string;
}

function pageActionConfig(message: TabMessage): PageActionConfig | null {
  switch (message.source) {
    case "bugzilla": {
      if (message.jira) {
        return {
          title: "Open Jira Issue",
          icon: "jira.ico",
        };
      }
      break;
    }
    case "jira": {
      if (message.bug) {
        return {
          title: "Open Bugzilla Bug",
          icon: "bugzilla.ico",
        };
      }

      let action = Actions.find((ac) => ac.project == message.project);
      if (action) {
        return {
          title: "Create Bugzilla Bug",
          icon: "bugzilla.ico",
        };
      }
      break;
    }
  }

  return null;
}

function openPage(
  url: string,
  openerTabId: number | undefined,
  modifiers: PageAction.OnClickDataModifiersItemEnum[]
) {
  browser.tabs.create({
    openerTabId,
    url: url,
  });
}

function updatePageAction(tabId: number, message: TabMessage) {
  let config = pageActionConfig(message);

  if (config) {
    browser.pageAction.setTitle({
      tabId,
      title: config.title,
    });
    browser.pageAction.setIcon({
      tabId,
      path: `icons/${config.icon}`,
    });
    browser.pageAction.show(tabId);
  } else {
    browser.pageAction.hide(tabId);
  }
}

function createBug(
  jira: JiraMessage,
  openerTabId: number,
  modifiers: PageAction.OnClickDataModifiersItemEnum[]
) {
  try {
    let action = Actions.find((ac) => ac.project == jira.project);
    if (!action) {
      throw new Error(`Unknown action for ${jira.project}`);
    }

    let page = new URL(jira.page);
    let bugzilla = JiraMap.get(page.origin);

    let createUrl = new URL("/enter_bug.cgi", bugzilla);
    createUrl.searchParams.set("short_desc", jira.summary);
    createUrl.searchParams.set("status_whiteboard", `[${action.whiteboard}]`);
    createUrl.searchParams.set(
      "see_also",
      `${page.origin}/browse/${jira.project}-${jira.id}`
    );

    openPage(createUrl.toString(), openerTabId, modifiers);
  } catch (e) {
    console.error(e);
  }
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

  let message = TabMap.get(tab.id);
  if (!message) {
    return;
  }

  switch (message.source) {
    case "bugzilla": {
      if (message.jira) {
        openPage(message.jira, tab.id, modifiers);
      }
      break;
    }
    case "jira": {
      if (message.bug) {
        openPage(message.bug, tab.id, modifiers);
      } else {
        createBug(message, tab.id, modifiers);
      }
      break;
    }
  }
}

function onMessage(message: TabMessage, sender: Runtime.MessageSender) {
  let tabId = sender.tab?.id;
  if (!tabId) {
    return;
  }

  console.log("onMessage", message);
  TabMap.set(tabId, message);
  updatePageAction(tabId, message);
}

async function loadConfig() {
  let response = await fetch(new URL("/whiteboard_tags/", JBI));
  if (!response.ok) {
    return;
  }

  let actions: Record<string, any> = await response.json();
  Actions = [];

  for (let action of Object.values(actions)) {
    let { jira_project_key: project, whiteboard_tag: whiteboard } =
      action.parameters ?? {};

    if (project && whiteboard) {
      Actions.push({ project, whiteboard });
    }
  }

  for (let [tabId, message] of TabMap) {
    updatePageAction(tabId, message);
  }
}

function init() {
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

  loadConfig();
}

init();
