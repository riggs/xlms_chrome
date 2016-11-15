/**
 * Created by riggs on 7/31/16.
 *
 * Core business logic of App.
 */
'use strict';


import {DEBUG, DEVEL, noop} from "./utils";

// External library imports.
import URI from 'urijs';

// Internal imports.
import user_input, {get_input, Window_Closed_Error} from './user_input';
import * as XLMS_REST from './XLMS_REST';
import {vendor_ID_key, product_ID_key} from './constants';
import * as device from './device';


async function init() {

  // window.launch_url set just before 'load' event by background.js.
  let endpoint_URL = XLMS_REST.parse_launch_URL(window.launch_url);
  DEBUG(`endpoint_URL: ${endpoint_URL}`);

  let session_data = await XLMS_REST.get_session_data(endpoint_URL);
  DEBUG(session_data);
  if (DEVEL) {window.session_data = session_data;}

  // Normalize data for chrome.hid API.
  let device_filter = [];
  session_data.allowed_devices.forEach((device) => {
    device_filter.push({vendorId: device[vendor_ID_key], productId: device[product_ID_key]})
  });

  // Ensure a compatible device is connected.
  async function connect(filter) {
    try {
      return await device.find(filter);
    } catch(error) {
      if (error instanceof device.DeviceError) {
        // FIXME: Display separate error window for too many connected devices.
        try {
          let result = await user_input(`Error: ${error.message}`, {
            Refresh: async () => await connect(filter),
            Exit: exit
          });
          return await result();
        } catch (error) {
          if (error instanceof Window_Closed_Error) {
            exit();
          } else {
            throw error;
          }
        }
      } else {
        throw error;
      }
    }
  }
  let connected_device = await connect(device_filter);

  // TODO: Implement
  video.configure(session_data.video_configuration);

  // Initialize plugin.
  const plugin = document.getElementById('plugin');
  plugin.clearData({since: 0}, {cache: true});
  let set_plugin_size = () => {
    plugin.style.height = window.innerHeight + "px";
    plugin.style.width = window.innerWidth + "px";
  };
  set_plugin_size();
  window.onresize = set_plugin_size;

  // Create Promise that resolves when plugin finishes loading.
  let plugin_load = new Promise((resolve, reject) => plugin.addEventListener('loadstop', () => {
    DEBUG('loadstop');
    resolve()
  }));

  // Navigate plugin to content hosted in XLMS.
  // TODO: Dev setting causes window prompt for location to load plugin from.
  // DEBUG(`Setting plugin_URL to localhost`);
  if (DEVEL) {await user_input("Set window.session_data.plugin_URL to desired location before accepting this message.", {OK: noop});}
  plugin.src = session_data.plugin_URL;

  // Explicitly allow getUserMedia access from the plugin.
  plugin.addEventListener('permissionrequest', event => {
    DEBUG(event);
    if (event.permission === 'media') {
      event.request.allow();
    }
  });

  // Wait for plugin to load and for device connection to initialize.
  await Promise.all([
    plugin_load,
    device.initialize(connected_device.deviceId)
  ]);

  // Set up admin message handler.
  const admin_message_channel = new MessageChannel();
  admin_message_channel.port1.onmessage = (event) => {
    DEBUG(event.data);
    switch (event.data.type) {
      case "results":
        XLMS_REST.send_results(endpoint_URL, event.data.results);
        break;
      case "exit":
        exit();
        break;
      default:
        WARN("Unknown message:", event);
    }
  };

  // Set up user_input communication with plugin.
  const user_input_channel = new MessageChannel();
  user_input_channel.port1.onmessage = async (event) => {
    DEBUG(event.data);
    let {message, option_strings} = event.data;
    let result;
    try {
      result = await get_input(message, option_strings);
    } catch (error) {
      if (error instanceof Window_Closed_Error) {
        result = null;
      } else {
        throw error;
      }
    } finally {
      user_input_channel.port1.postMessage({result});
    }
  };

  // Set up HID message polling and sending to plugin.
  const HID_message_channel = new MessageChannel();
  let HID_poller = async () => {
    try {
      let message = await device.receive();
      DEBUG(message);
      HID_message_channel.port1.postMessage(message);
      setTimeout(HID_poller, 0);
    } catch (error) {
      if (error instanceof device.DeviceError) {
        DEBUG("DeviceError in poller.");
        admin_message_channel.port1.postMessage({type: "device_error", error});
      } else {
        throw error;
      }
    }
  };

  // Initialize plugin.
  let origin = new URI(session_data.plugin_URL).origin();
  // Send config and MessageChannel ports to plugin.
  plugin.contentWindow.postMessage(
    {type: "initialization", session_data},
    origin,
    [user_input_channel.port2, HID_message_channel.port2, admin_message_channel.port2]
  );

  // Start receiving input messages and passing them to the plugin.
  setTimeout(HID_poller, 0);

  // 'configuration' object is an array of objects, with each object having a single key: value pair.
  // This is to ensure the order is consistent.
  device.set_feature('config', ...session_data.configuration.map(Number));

  // TODO: Send device timestamp.
  device.send('timestamp', Date.now());

}

window.addEventListener('load', init);
window.device = device;
window.XLMS = XLMS_REST;