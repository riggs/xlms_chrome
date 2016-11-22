/**
 * Created by riggs on 8/14/16.
 */
"use strict";

export const DEVEL = 1; // Set to something falsey, something truthy, or "test" for test deployment.

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

