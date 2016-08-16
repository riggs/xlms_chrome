/**
 * Created by riggs on 8/14/16.
 */
"use strict";

const DEBUG = true;

export default function (...args) {
  if (DEBUG) {
    console.log(...args);
  }
};
