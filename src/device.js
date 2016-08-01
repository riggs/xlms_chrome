/**
 * Created by riggs on 8/1/16.
 *
 * API for communicating with XLMS HID device.
 */

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

export function receive(callback) {
  if (not_connected()) return;
  chrome.hid.receive(connection_ID, (report_ID, data_buffer) => {
    let {name, unpack} = device.reports[report_ID][INPUT_REPORT];
    callback(name, unpack(data_buffer));
  })
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


export default function (device_ID) {
  chrome.hid.connect(device_ID, (connection) => {
    device.connection_ID = connection.connectionId;

  });
  // TODO: Error handling.
}
