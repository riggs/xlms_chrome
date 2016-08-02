/**
 * Created by riggs on 8/1/16.
 *
 * API for communicating with XLMS HID device.
 */

import ChromePromise from 'chrome-promise';

chrome.promise = new ChromePromise();

const device ={
  connection_ID: null,
  reports: {},
  report_names: {},
};

/* device.reports structure:
 * {
 *   report_ID: {
 *     REPORT_TYPE: {
 *       name: "report_name",
 *       pack: (object) => {ArrayBuffer},
 *       unpack: {ArrayBuffer} => {object}
 *     }
 *   }
 * }
 */

const INPUT_REPORT = Symbol();
const OUTPUT_REPORT = Symbol();
const GET_FEATURE = Symbol();
const SET_FEATURE = Symbol();


function not_connected() {
  if (device.connection_ID === null) {
    // TODO: Report error.
  }
  return false;
}

// TODO: Use async/await

export async function receive() {
  if (not_connected()) return;
  let report_ID, data_buffer = await chrome.promise.hid.receive(connection_ID);
  let {name, unpack} = device.reports[report_ID][INPUT_REPORT];
  return {name: name, data: unpack(data_buffer)};
}


export function send(report_name, data, callback) {
  if (not_connected()) return;

}


export function get_feature(report_name, callback) {
  if (not_connected()) return;

}


export function set_feature(report_name, data, callback) {
  if (not_connected()) return;

}


export default async function (device_ID) {
  device.connection_ID = await chrome.promise.hid.connect(device_ID).connectionId;
  // TODO: Error handling.
}
