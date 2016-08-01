/**
 * Created by riggs on 7/31/16.
 */


// Internal imports.
import user_input_init from 'user_input_window';
import user_input from 'user_input';
import * as XLMS_REST from 'XLMS_REST';
import * as video from 'video';
import {vendor_ID_key, product_ID_key} from 'constants';
import device from 'device';


function get_device(device_filter, callback) {
  chrome.hid.getDevices(device_filter, (devices) => {
    switch (devices.length) {
      case 0:
        // TODO: Display error window for no detected devices.
        break;
      case 1:
        // FIXME: use async await
        callback(devices[0]);
        break;
      default:
        // TODO: Display error window for too many connected devices.
        user_input("Error: Multiple devices detected.", {
          Refresh: () => {get_device(device_filter, callback)},
          Quit: () => chrome.app.window.current().close()
        });
        break;
    }
  });
}


function init() {

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

  // FIXME: use async/await
  get_device(device_filter, (connected_device) => {
    // TODO: Implement
    video.configure(session_data.video_configuration);

    const plugin = document.getElementById('plugin');
    plugin.src = session_data.plugin_URL;
    // TODO: Setup listeners for when plugin webview loads.

    device(connected_device.deviceId);
  });

}

window.addEventListener('load', init);
