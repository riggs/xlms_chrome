/**
 * Created by riggs on 8/14/16.
 */
"use strict";

export const DEVEL = true;

export default function (...args) {
  if (DEVEL) {
    console.log(...args);
  }
};
