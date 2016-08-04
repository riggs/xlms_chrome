/**
 * Created by riggs on 8/1/16.
 *
 * API for communicating with XLMS HID device.
 */

// External Libraries.
import ChromePromise from 'chrome-promise';
chrome.promise = new ChromePromise();


// Byte flags from protocol also used in lieu of strings for keys.
const INPUT_REPORT = 0x01;
const OUTPUT_REPORT = 0x02;
const FEATURE = 0x04;


// Base structure for object used to hold de/serialization functions for HID reports.
// This allows for overloading initial `get_feature('admin')` call to populate object.
const DEFAULT_DEVICE = {
  device_ID: null,
  connection_ID: null,
  reports: {
    1: {
      [FEATURE]: {
        name: "admin",
        pack: () => {},
        unpack: parse_admin_report
      }
    }
  },
  report_names: {
    [INPUT_REPORT]: {},
    [OUTPUT_REPORT]: {},
    [FEATURE]: {
      'admin': 1,
    }
  },
};

let device = DEFAULT_DEVICE;

let utf_8_decode = new TextDecoder('utf-8', {fatal: true}).decode;


export class DeviceError extends Error {}


function parse_admin_report(buffer) {

  // Defined by the protocol.
  let admin_report = new Uint8Array([0x00, 0x0D, 0x01, 0x04, 0x05, 0x61, 0x64, 0x6D, 0x69, 0x6E, 0x01, 0x00, 0x00]);

  // Create a view of the buffer for the current report.
  let current_report_byte_offset = 0;
  let current_report = new Uint8Array(buffer, current_report_byte_offset, admin_report.byteLength);

  // Test to see if admin report is first.
  if (current_report.byteLength != admin_report.byteLength) {
    reset_module(device.device_ID);
    throw new DeviceError("Incompatible device.");
  }

  // Iterate and compare arrays.
  for (let i = 0; i < admin_report.byteLength; i++) {
    if (admin_report[i] !== current_report[i]) {
      throw new DeviceError("Incompatible device.");
    }
  }

  // Device appears to be compatible, update byte offset for next Report.
  current_report_byte_offset += admin_report.byteLength;

  // Parse the rest of the report and build the object to hold de/serialization functions.
  while (current_report_byte_offset < buffer.byteLength) {

    // Create new DataView for this report.
    current_report = new DataView(buffer, current_report_byte_offset);
    let byte_offset = 0;

    let report_length = current_report.getUint16(byte_offset);
    byte_offset += 2;

    let report_ID = current_report.getUint8(byte_offset);
    byte_offset += 1;

    let report_types_byte = current_report.getUint8(byte_offset);
    byte_offset += 1;

    let report_types = [];
    for (const report_type in [INPUT_REPORT, OUTPUT_REPORT, FEATURE]) {
      // Bit-wise AND to check for flags.
      if (report_types_byte & report_type) {
        report_types.push(report_type);
      }
    }

    let report_name_length = current_report.getUint8(byte_offset);
    byte_offset += 1;

    // Decode from a new view of the buffer only containing the name in UTF-8 bytes.
    let report_name = utf_8_decode(new Uint8Array(current_report_byte_offset + byte_offset, report_name_length));
    byte_offset += report_name_length;

    // Update name: ID mapping in `device` object.
    for (const report_type in report_types) {
      device.report_names[report_type][report_name] = report_ID;
    }

    // Build de/serialization functions.
    while (byte_offset < report_length) {

      // TODO: build de/serializers

      byte_offset++;
    }


    // Update the 'pointer' to the start of the report.
    current_report_byte_offset += report_length;
  }

  return "0x00, 0x0D, 0x01, 0x04, 0x05, 0x61, 0x64, 0x6D, 0x69, 0x6E, 0x01, 0x00, 0x00"
}


function reset_module(removed_device_ID) {
  // Ignore other removed devices.
  if (removed_device_ID === device.device_ID) {
    // Reset device info.
    device = DEFAULT_DEVICE;
    // Clean up after yourself.
    chrome.hid.onDeviceRemoved.removeListener(reset_module);
    // TODO: Notify user
  }
}


function verify_connection() {
  if (device.connection_ID === null) {
    throw new DeviceError("No device connected.");
  }
}


export async function receive() {
  verify_connection();
  let [report_ID, data_buffer] = await chrome.promise.hid.receive(device.connection_ID);
  let {name, unpack} = device.reports[report_ID][INPUT_REPORT];
  return {name: name, data: unpack(data_buffer)};
}


export async function send(report_name, data) {
  verify_connection();
  let report_ID = device.report_names[OUTPUT_REPORT][report_name];
  let buffer = device.reports[report_ID][OUTPUT_REPORT].pack(data);
  return await chrome.promise.hid.send(device.connection_ID, report_ID, buffer);
}


export async function get_feature(report_name) {
  verify_connection();
  let report_ID = device.report_names[FEATURE][report_name];
  let data = await chrome.promise.hid.receiveFeatureReport(device.connection_ID, report_ID);
  return device.reports[report_ID][FEATURE].unpack(data);
}


export async function set_feature(report_name, data) {
  verify_connection();
  let report_ID = device.report_names[FEATURE][report_name];
  let buffer = device.reports[report_ID][FEATURE].pack(data);
  return await chrome.promise.hid.sendFeatureReport(device.connection_ID, report_ID, buffer);
}


export async function find(device_filter) {
  let devices = await chrome.promise.hid.getDevices(device_filter);
  switch (devices.length) {
    case 0:
      throw new DeviceError("Device not detected.");
      break;
    case 1:
      return devices[0];
      break;
    default:
      throw new DeviceError("Multiple devices detected.");
      break;
  }
}


export async function initialize(device_ID) {
  device.connection_ID = (await chrome.promise.hid.connect(device_ID)).connectionId;
  device.device_ID = device_ID;

  // If device is removed, reset state of module. `initialize` must be called again with appropriate device_ID.
  chrome.hid.onDeviceRemoved.addListener(reset_module);

  // Overloaded function to do initial parsing of HID report and populating de/serialization functions.
  await get_feature('admin');

}
