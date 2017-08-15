/**
 * Created by riggs on 8/14/16.
 */
"use strict";

export const DEVEL = 0; // Set to something truthy for development, something falsey for deployment, or "test" for test deployment with test app.

export function DEBUG(...args) {
  if (DEVEL) {
    console.log(...args);
  }
}

export function WARN(...args) {
  console.warn(...args);
}

export function ERROR(...args) {
  console.error(...args);
}

export function noop() {}

export function exit() {
  chrome.app.window.current().close();
}
if (DEVEL) {window.exit = exit;}

