/**
 * Created by riggs on 8/1/16.
 *
 * API for communicating with XLMS HID device.
 */

import ChromePromise from 'chrome-promise';

chrome.promise = new ChromePromise();


const INPUT_REPORT = 0x01;
const OUTPUT_REPORT = 0x02;
const GET_FEATURE = 0x04;
const SET_FEATURE = 0x08;


const device = {
  connection_ID: null,
  reports: {
    1: {
      [GET_FEATURE]: {
        name: "admin",
        unpack: parse_admin_report
      }
    }
  },
  report_names: {
    [INPUT_REPORT]: {},
    [OUTPUT_REPORT]: {},
    [GET_FEATURE]: {
      'admin': 1,
    },
    [SET_FEATURE]: {}
  },
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


function parse_admin_report(buffer) {
  // TODO: Verify buffer begins with admin report serialization.
  // TODO: Parse admin report.
}


function not_connected() {
  if (device.connection_ID === null) {
    // TODO: Report error.
  }
  return false;
}


export async function receive() {
  if (not_connected()) return;
  try {
    let [report_ID, data_buffer] = await chrome.promise.hid.receive(device.connection_ID);
    let {name, unpack} = device.reports[report_ID][INPUT_REPORT];
    return {name: name, data: unpack(data_buffer)};
  } // TODO: Error handling
}


export async function send(report_name, data) {
  if (not_connected()) return;
  try {
    let report_ID = device.report_names[OUTPUT_REPORT][report_name];
    let buffer = device.reports[report_ID][OUTPUT_REPORT].pack(data);
    return await chrome.promise.hid.send(device.connection_ID, report_ID, buffer);
  } // TODO: Error handling
}


export async function get_feature(report_name) {
  if (not_connected()) return;
  try {
    let report_ID = device.report_names[GET_FEATURE][report_name];
    let data = await chrome.promise.hid.receiveFeatureReport(device.connection_ID, report_ID);
    return device.reports[report_ID][GET_FEATURE].unpack(data);
  } // TODO: Error handling
}


export async function set_feature(report_name, data) {
  if (not_connected()) return;
  try {
    let report_ID = device.report_names[SET_FEATURE][report_name];
    let buffer = device.reports[report_ID][SET_FEATURE].pack(data);
    return await chrome.promise.hid.sendFeatureReport(device.connection_ID, report_ID, buffer);
  } // TODO: Error handling
}


export default async function (device_ID) {
  try {
    device.connection_ID = await chrome.promise.hid.connect(device_ID).connectionId;

    function on_device_removed(removed_device_ID) {
      if (removed_device_ID == device_ID) {
        device.connection_ID = null;
        device.reports = {
          1: {
            [GET_FEATURE]: {
              name: "admin",
              unpack: parse_admin_report
            }
          }
        };
        device.report_names = {
          [INPUT_REPORT]: {},
          [OUTPUT_REPORT]: {},
          [GET_FEATURE]: {
            'admin': 1,
          },
          [SET_FEATURE]: {}
        };
        // TODO: Notify user
      }
    }
    chrome.hid.onDeviceRemoved.addListener(on_device_removed);

    get_feature('admin');

  } // TODO: Error handling
}
