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
const FEATURE_REPORT = 0x04;


// Base structure for object used to hold de/serialization functions for HID reports.
// This allows for overloading initial `get_feature('admin')` call to populate object.
const DEFAULT_DEVICE = {
  device_ID: null,
  connection_ID: null,
  reports: {
    1: {
      [FEATURE_REPORT]: {
        name: "admin",
        pack: () => {},
        unpack: parse_admin_report
      }
    }
  },
  report_names: {
    [INPUT_REPORT]: {},
    [OUTPUT_REPORT]: {},
    [FEATURE_REPORT]: {
      'admin': 1,
    }
  },
};

let device = DEFAULT_DEVICE;


let utf_8_decode = new TextDecoder('utf-8', {fatal: true}).decode;
let utf_8_encode = new TextEncoder('utf-8', {fatal: true}).encode;


export class DeviceError extends Error {}


function parse_admin_report(buffer) {

  // Defined by the protocol.
  let admin_report = new Uint8Array([0x00, 0x0D, 0x01, 0x04, 0x05, 0x61, 0x64, 0x6D, 0x69, 0x6E, 0x01, 0x00, 0x00]);

  // Create a view of the buffer for the current report.
  let report_start_byte_offset = 0;
  let current_report = new Uint8Array(buffer, report_start_byte_offset, admin_report.byteLength);

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
  report_start_byte_offset += admin_report.byteLength;

  // Parse the rest of the report and build the object to hold de/serialization functions.
  while (report_start_byte_offset < buffer.byteLength) {

    // Extract metadata about report.

    // Create new DataView for this report.
    current_report = new DataView(buffer, report_start_byte_offset);
    let report_parser_byte_offset = 0;

    let report_length = current_report.getUint16(report_parser_byte_offset);
    report_parser_byte_offset += 2;

    let report_ID = current_report.getUint8(report_parser_byte_offset);
    report_parser_byte_offset += 1;

    let report_types_byte = current_report.getUint8(report_parser_byte_offset);
    report_parser_byte_offset += 1;

    let report_types = [];
    for (const report_type in [INPUT_REPORT, OUTPUT_REPORT, FEATURE_REPORT]) {
      // Bit-wise AND to check for flags.
      if (report_types_byte & report_type) {
        report_types.push(report_type);
      }
    }

    let report_name_length = current_report.getUint8(report_parser_byte_offset);
    report_parser_byte_offset += 1;

    // Decode from a new view of the buffer only containing the name in UTF-8 bytes.
    let report_name = utf_8_decode(new Uint8Array(buffer, report_start_byte_offset + report_parser_byte_offset, report_name_length));
    report_parser_byte_offset += report_name_length;

    // Update name: ID mapping in `device` object.
    for (const report_type in report_types) {
      device.report_names[report_type][report_name] = report_ID;
    }

    // Build parser for report data.

    // Build de/serialization functions.
    let data_parser_byte_offset = 0;
    let utf_8_length = 0;
    let pack_funcs = [];
    let unpack_funcs = [];
    while (report_parser_byte_offset < report_length) {
      let offset = data_parser_byte_offset;
      let serialization_byte = current_report.getUint8(report_parser_byte_offset);
      let serialization_type = serialization_byte & 0b11;
      let serialization_length = serialization_byte >> 2;
      switch (serialization_type) {
        case 0:   // UTF-8

          // Update length of total UTF-8 bytes to parse with current length.
          utf_8_length += serialization_length;

          if (
            // Extend byte: Don't update the parser byte offset or reset UTF-8 byte length, proceed to next byte.
            (serialization_length === 63 && (current_report.getUint8(report_parser_byte_offset + 1) & 0b11) === 0)
            ||  // Or
            // Null byte, nothing to do, unless proceeded by UTF-8 'continue' byte, as indicated by utf_8_length.
            (serialization_length === 0 && utf_8_length === 0)
          ) {
            report_parser_byte_offset++;
            continue;
          }

          // Add de/serialization functions.
          let length = utf_8_length;
          unpack_funcs.push((buffer) => utf_8_decode(new Uint8Array(buffer, offset, length)));
          pack_funcs.push((text, buffer) => {
            let utf_8 = utf_8_encode(text);
            let view = new Uint8Array(buffer, offset, length);
            view.set(utf_8);
          });

          // Set length to what was actually consumed.
          serialization_length = utf_8_length;

          // Reset length counter.
          utf_8_length = 0;

          break;
        case 1:   // Uint
          switch (serialization_length) {
            case 8:   // Uint64, used for millisecond timestamps.
              // Need to divide and multiply by max Uint32 instead of bit-shifting because Javascript implicitly
              // converts to Int32 before performing bitwise operations.
              const max_Uint32 = 2**32;
              unpack_funcs.push((buffer) => {
                let [high, low] = new Uint32Array(buffer, offset, serialization_length);
                return high * max_Uint32 + low;
              });
              pack_funcs.push((value, buffer) => {
                let high = Math.floor(value/max_Uint32);
                let low = value % max_Uint32;
                new Uint32Array(buffer, offset, serialization_length).set([high, low]);
              });
              break;
            case 1:   // Uint8
            case 2:   // Uint16
            case 4:   // Uint32
              let bits = serialization_length * 8;
              unpack_funcs.push((buffer) => new DataView(buffer)[`getUint${bits}`](offset));
              pack_funcs.push((value, buffer) => new DataView(buffer)[`setUint${bits}`](offset, value));
              break;
          }
          break;
        case 2:   // Int
          switch (serialization_length) {
            case 1:   // Int8
            case 2:   // Int16
            case 4:   // Int32
              let bits = serialization_length * 8;
              unpack_funcs.push((buffer) => new DataView(buffer)[`getInt${bits}`](offset));
              pack_funcs.push((value, buffer) => new DataView(buffer)[`setInt${bits}`](offset, value));
              break;
          }
          break;
        case 3:   // Float
          switch (serialization_length) {
            case 4:   // Float32
            case 8:   // Float64
              let bits = serialization_length * 8;
              unpack_funcs.push((buffer) => new DataView(buffer)[`getFloat${bits}`](offset));
              pack_funcs.push((value, buffer) => new DataView(buffer)[`setFloat${bits}`](offset, value));
               break;
          }
          break;
      }
      // Advance offset based on bytes consumed by serialization.
      data_parser_byte_offset += serialization_length;
      // Advance parser byte.
      report_parser_byte_offset++;
    }

    // Combine de/serialization functions into single parser function.
    let unpack = (buffer) => {return unpack_funcs.map(fn => fn(buffer))};
    let pack = (array) => {
      // After all serialization bytes have been parsed, the total parser byte offset is equal to total data buffer length.
      let buffer = new ArrayBuffer(data_parser_byte_offset);
      pack_funcs.forEach((fn, index) => {
        fn(array[index], buffer);
      });
      return buffer;
    };

    // Store in `device` object.

    // If this report is an input report, only need unpack function
    if (report_types.indexOf(INPUT_REPORT) !== -1) {
      device[report_ID][INPUT_REPORT] = {name: report_name, unpack: unpack}
    }
    // If this report is an output report, only need pack function
    if (report_types.indexOf(OUTPUT_REPORT) !== -1) {
      device[report_ID][OUTPUT_REPORT] = {name: report_name, pack: pack}
    }
    // If this report is a feature report, need both pack and unpack functions.
    if (report_types.indexOf(FEATURE_REPORT) !== -1) {
      device[report_ID][FEATURE_REPORT] = {name: report_name, pack: pack, unpack: unpack}
    }

    // Update the byte offset to the start of the report.
    report_start_byte_offset += report_length;
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
  let report_ID = device.report_names[FEATURE_REPORT][report_name];
  let data = await chrome.promise.hid.receiveFeatureReport(device.connection_ID, report_ID);
  return device.reports[report_ID][FEATURE_REPORT].unpack(data);
}


export async function set_feature(report_name, data) {
  verify_connection();
  let report_ID = device.report_names[FEATURE_REPORT][report_name];
  let buffer = device.reports[report_ID][FEATURE_REPORT].pack(data);
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
