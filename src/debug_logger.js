/**
 * Created by riggs on 8/14/16.
 */
"use strict";

export const DEBUG_FLAG = true;

export default function (...args) {
  if (DEBUG_FLAG) {
    console.log(...args);
  }
};
