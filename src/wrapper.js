/**
 * Created by riggs on 7/31/16.
 */


// Internal imports.
import user_input_init from './user_input_window';
import user_input from './user_input';
import * as XLMS_REST from './XLMS_REST';
import * as video from './video';
import {vendor_ID_key, product_ID_key} from './constants';
import * as device from './device';


async function init() {

  // TODO: Determine required config.
  user_input_init(config);

  // launch_url set just before 'load' event by background.js.
  let endpoint_URI = XLMS_REST.parse_launch_URL(window.launch_url);

  // TODO: get session data from XLMS via REST:
  let session_data = XLMS_REST.get_session_data(endpoint_URI);

  // Normalize data for chrome.hid API.
  let device_filter = [];
  session_data.allowed_devices.forEach((device) => {
    device_filter.push({vendorId: device[vendor_ID_key], productId: device[product_ID_key]})
  });

  // Ensure a compatible device is connected.
  let connected_device = null;
  while (connected_device === null) {
    try {
      connected_device = await device.find(device_filter);
    } catch(error) {
      // TODO: Display error window for too many connected devices.
      return await user_input(`Error: ${error.message}`, {
        Refresh: async () => {
          connected_device = await device.find(device_filter);
        },
        Quit: () => chrome.app.window.current().close()
      });
    }
  }

  // TODO: Implement
  video.configure(session_data.video_configuration);

  // Load plugin.
  const plugin = document.getElementById('plugin');
  plugin.src = session_data.plugin_URL;
  // TODO: Setup listeners for when plugin webview loads.

  // Connect to device.
  await device.initialize(connected_device.deviceId);


}

// window.addEventListener('load', init);
window.device = device;