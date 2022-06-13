import { Browser } from "webextension-polyfill";

declare global {
  var browser: Browser;
  var content: Window;
}
