/**
 * Created by riggs on 8/1/16.
 *
 * API for communicating with XLMS HID device.
 */
"use strict";

// App-wide DEBUG logging function.
import {DEBUG, WARN} from "./utils";

// External Libraries.
import ChromePromise from 'chrome-promise';
chrome.promise = new ChromePromise();


// Byte flags from protocol, also as keys.
const INPUT_REPORT = 0x01;
const OUTPUT_REPORT = 0x02;
const FEATURE_REPORT = 0x04;


// Base structure for object used to hold de/serialization functions for HID reports.
// This allows for overloading initial `get_feature('admin')` call to populate object.
export let device = {};

export function initialize_device() {
  // Copy default values into device object.
  Object.assign(device,
    {
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
    }
  );
}
initialize_device();


function reset_module(removed_device_ID) {
  // Ignore other removed devices.
  if (removed_device_ID === device.device_ID) {
    // Reset device object.
    initialize_device();
    // Clean up after yourself.
    chrome.hid.onDeviceRemoved.removeListener(reset_module);
  }
}


let utf_8_decoder = new TextDecoder('utf-8', {fatal: true});
let utf_8_encoder = new TextEncoder('utf-8', {fatal: true});


export class DeviceError extends Error {}


function parse_admin_report(buffer) {

  // FIXME: Handle future versions of protocol.
  // Defined by the protocol.
  let admin_report = new Uint8Array([0x00, 0x0D, 0x01, 0x04, 0x05, 0x61, 0x64, 0x6D, 0x69, 0x6E, 0x01, 0x00, 0x00]);

  // Get the initial report length from first two bytes.
  let report_length = (new DataView(buffer, 0, 2)).getUint16();

  // Test to see if admin report length is correct.
  if (report_length != admin_report.byteLength) {
    reset_module(device.device_ID);
    throw new DeviceError("Incompatible device.");
  }

  // Create a view of the buffer for the current report.
  let report_start_byte_offset = 0;
  let current_report = new Uint8Array(buffer, report_start_byte_offset, report_length);

  // Iterate and compare arrays.
  for (let i = 0; i < admin_report.byteLength; i++) {
    if (admin_report[i] !== current_report[i]) {
      // FIXME: Handle future versions of protocol.
      WARN(`byte ${i} discrepancy: admin: ${admin_report[i]}, report: ${current_report[i]}`);
      reset_module(device.device_ID);
      throw new DeviceError("Incompatible device.");
    }
  }

  // Device appears to be compatible, update byte offset for next Report.
  report_start_byte_offset += report_length;

  let result = current_report;

  // Parse the rest of the report and build the object to hold de/serialization functions.
  while (report_start_byte_offset < buffer.byteLength) {

    // Extract metadata about report.

    // Create new DataView for this report.
    current_report = new DataView(buffer, report_start_byte_offset);
    let report_parser_byte_offset = 0;

    let report_length = current_report.getUint16(report_parser_byte_offset);
    // DEBUG(`report_length: ${report_length}`);
    report_parser_byte_offset += 2;

    let report_ID = current_report.getUint8(report_parser_byte_offset);
    // DEBUG(`report_ID: ${report_ID}`);
    report_parser_byte_offset += 1;

    let report_types_byte = current_report.getUint8(report_parser_byte_offset);
    // DEBUG(`report_type_byte: ${report_types_byte}`);
    report_parser_byte_offset += 1;

    let report_types = [];
    [INPUT_REPORT, OUTPUT_REPORT, FEATURE_REPORT].forEach(report_type => {
      if (report_types_byte & report_type) {
        report_types.push(report_type);
      }
    });
    // DEBUG('report_types: ', report_types);

    let report_name_length = current_report.getUint8(report_parser_byte_offset);
    report_parser_byte_offset += 1;

    // Decode from a new view of the buffer only containing the name in UTF-8 bytes.
    let report_name = utf_8_decoder.decode(new Uint8Array(buffer, report_start_byte_offset + report_parser_byte_offset, report_name_length));
    // DEBUG(`report_name: ${report_name}`);
    report_parser_byte_offset += report_name_length;

    // Update name: ID mapping in `device` object.
    report_types.forEach(report_type => {
      device.report_names[report_type][report_name] = report_ID;
    });

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
          // unpack_funcs.push((buffer) => utf_8_decoder.decode(new Uint8Array(buffer, offset, length)));
          unpack_funcs.push((buffer) => {
            // DEBUG(`utf8 unpack ${hex_parser(buffer.slice(offset, length))}`);
            return utf_8_decoder.decode(new Uint8Array(buffer, offset, length))
          });
          pack_funcs.push((text, buffer) => {
            let utf_8 = utf_8_encoder.encode(text);
            let view = new Uint8Array(buffer, offset, length);
            view.set(utf_8);
            // DEBUG("utf8 pack ", hex_parser(buffer.slice(offset, length)));
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
                // Uint32Array length parameter is length of Uint32Array, to be created, not byte length.
                let data_view = new DataView(buffer, offset, serialization_length);
                let high = data_view.getUint32(0);
                let low = data_view.getUint32(4);
                // DEBUG(`Uint64 unpack ${hex_parser(buffer.slice(offset, serialization_length))} to ${high * max_Uint32 + low}`);
                return high * max_Uint32 + low;
              });
              pack_funcs.push((value, buffer) => {
                let high = Math.floor(value/max_Uint32);
                let low = value % max_Uint32;
                let data_view = new DataView(buffer, offset, serialization_length);
                data_view.setUint32(0, high);
                data_view.setUint32(4, low);
                // DEBUG(`Uint64 pack ${value} to ${hex_parser(buffer.slice(offset, serialization_length))}`)
              });
              break;
            case 1:   // Uint8
            case 2:   // Uint16
            case 4:   // Uint32
              let bits = serialization_length * 8;
              // unpack_funcs.push((buffer) => new DataView(buffer)[`getUint${bits}`](offset));
              unpack_funcs.push((buffer) => {
                // DEBUG(`DataView(${hex_parser(buffer)}).getUint${bits}(${offset})`);
                return new DataView(buffer)[`getUint${bits}`](offset)
              });
              // pack_funcs.push((value, buffer) => new DataView(buffer)[`setUint${bits}`](offset, value));
              pack_funcs.push((value, buffer) => {
                // DEBUG(`DataView(${hex_parser(buffer)}).setUint${bits}(${offset}, ${value})`);
                return new DataView(buffer)[`setUint${bits}`](offset, value)
              });
              break;
          }
          break;
        case 2:   // Int
          switch (serialization_length) {
            case 1:   // Int8
            case 2:   // Int16
            case 4:   // Int32
              let bits = serialization_length * 8;
              // unpack_funcs.push((buffer) => new DataView(buffer)[`getInt${bits}`](offset));
              unpack_funcs.push((buffer) => {
                // DEBUG(`DataView(${hex_parser(buffer)}).getInt${bits}(${offset})`);
                return new DataView(buffer)[`getInt${bits}`](offset)
              });
              // pack_funcs.push((value, buffer) => new DataView(buffer)[`setInt${bits}`](offset, value));
              pack_funcs.push((value, buffer) => {
                // DEBUG(`DataView(${hex_parser(buffer)}).setInt${bits}(${offset}, ${value})`);
                return new DataView(buffer)[`setInt${bits}`](offset, value)
              });
              break;
          }
          break;
        case 3:   // Float
          switch (serialization_length) {
            case 4:   // Float32
            case 8:   // Float64
              let bits = serialization_length * 8;
              // unpack_funcs.push((buffer) => new DataView(buffer)[`getFloat${bits}`](offset));
              unpack_funcs.push((buffer) => {
                // DEBUG(`DataView(${hex_parser(buffer)}).getFloat${bits}(${offset})`);
                return new DataView(buffer)[`getFloat${bits}`](offset)
              });
              // pack_funcs.push((value, buffer) => new DataView(buffer)[`setFloat${bits}`](offset, value));
              pack_funcs.push((value, buffer) => {
                // DEBUG(`DataView(${hex_parser(buffer)}).setFloat${bits}(${offset}, ${value})`);
                return new DataView(buffer)[`setFloat${bits}`](offset, value)
              });
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

    // Create the object if its not there.
    if (!(report_ID in device.reports)) {
      device.reports[report_ID] = {};
    }

    // If this report is an input report, only need unpack function
    if (report_types.indexOf(INPUT_REPORT) !== -1) {
      device.reports[report_ID][INPUT_REPORT] = {name: report_name, unpack: unpack}
    }
    // If this report is an output report, only need pack function
    if (report_types.indexOf(OUTPUT_REPORT) !== -1) {
      device.reports[report_ID][OUTPUT_REPORT] = {name: report_name, pack: pack}
    }
    // If this report is a feature report, need both pack and unpack functions.
    if (report_types.indexOf(FEATURE_REPORT) !== -1) {
      device.reports[report_ID][FEATURE_REPORT] = {name: report_name, pack: pack, unpack: unpack}
    }

    // Update the byte offset to the start of the report.
    report_start_byte_offset += report_length;
  }

  return hex_parser(result);
}


function verify_connection() {
  if (device.connection_ID === null) {
    throw new DeviceError("No Device Connected.");
  }
}


export async function receive() {
  verify_connection();
  let [report_ID, data_buffer] = await chrome.promise.hid.receive(device.connection_ID);
  // DEBUG(`input ID:${report_ID} ${hex_parser(data_buffer)}`);
  if (!(report_ID in device.reports)) { return {name: 'unknown', data: null} }
  let {name, unpack} = device.reports[report_ID][INPUT_REPORT];
  return {name: name, data: unpack(data_buffer)};
}


export async function send(report_name, ...data) {
  verify_connection();
  let report_ID = device.report_names[OUTPUT_REPORT][report_name];
  if (typeof report_ID === "undefined") { return null }
  let data_buffer = device.reports[report_ID][OUTPUT_REPORT].pack(data);
  // DEBUG(`output ID:${report_ID} ${hex_parser(data_buffer)}`);
  return await chrome.promise.hid.send(device.connection_ID, report_ID, data_buffer);
}


export async function get_feature(report_name) {
  verify_connection();
  let report_ID = device.report_names[FEATURE_REPORT][report_name];
  if (typeof report_ID === "undefined") { return null }
  let data_buffer = await chrome.promise.hid.receiveFeatureReport(device.connection_ID, report_ID);
  // DEBUG(`get feature ID:${report_ID} ${hex_parser(data_buffer)}`);
  return device.reports[report_ID][FEATURE_REPORT].unpack(data_buffer.slice(1));
}


export async function set_feature(report_name, ...data) {
  verify_connection();
  let report_ID = device.report_names[FEATURE_REPORT][report_name];
  if (typeof report_ID === "undefined") { return null }
  DEBUG("data:", ...data);
  let data_buffer = device.reports[report_ID][FEATURE_REPORT].pack(data);
  DEBUG(`set feature ID:${report_ID} ${hex_parser(data_buffer)}`);
  return await chrome.promise.hid.sendFeatureReport(device.connection_ID, report_ID, data_buffer);
}


export async function find(filters) {
  DEBUG("device filters:", filters);
  let devices = await chrome.promise.hid.getDevices({filters});
  switch (devices.length) {
    case 0:
      throw new DeviceError("Device Not Detected.");
      break;
    case 1:
      return devices[0];
      break;
    default:
      throw new DeviceError("Multiple Devices Detected.");
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


export function hex_parser(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((i) => i.toString(16).toUpperCase())
    .join(" ");
}