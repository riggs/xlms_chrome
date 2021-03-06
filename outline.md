App Workflow
============

UI Window
---------
1. Launch.
    * Handled in background.js.
    * Show error message if not launched via XLMS.
    * Open UI wrapper in fullscreen.
        * Configure user_input API from wrapper.js
        * **TODO**: Make sure User Input window displays properly when app fullscreen.
1. Get REST data from XLMS.
    * Endpoint URL encoded as `endpoint` query parameter in `launchData.url`.
    * Error if invalid session data.
1. Search for appropriate detected device.
    * Device ID via REST data.
    * Error if not found.
    * Error if multiples found.
    * Future work: UI to select device, filtered by REST data.
1. Configure video API.
1. Load plugin.
    * URL from REST data.
    * Listen for `contentload` event.
1. Connect to device.
    1. Get HID report serialization feature report.
        * Error if unable to decode HID serialization.
    1. Set configuration feature report.
    1. Flag device as connected.

### Triggered Events
* On plugin `contentload` event:
    1. Send configuration, metrics, device IDs.
        * From REST data and connected device.
    1. Add listener for `message` events:
        * user_input
        * results
    1. Flag plugin as loaded.

* Once both plugin has loaded and proper device is connected:
    1. Send timestamp.
    1. Start receive polling loop.
        * Pass all USB messages to plugin via [`webview.contentWindow.postMessage` API](https://developer.chrome.com/apps/tags/webview#type-ContentWindow).
        * `usb_message`: report_name, deserialized data

* On `results` message:
    1. Send results to XLMS.
        * TODO: Details
    1. Close everything.

User Input Window
-----------------
New calls to API just replace message and buttons, don't create new windows.
### API for plugins
* user_input(message_string, options={key: value})
    * message_string, required: displayed to the user
    * options object, at least one key & value required:
        * Keys are displayed to users as buttons.
        * value returned based on user selection.
        * If user closes window instead, return last value

### Implementation
1. Send `user_input_request` message from plugin to app:
    * message_string
    * options array: user selectable options, keys from options object.
1. Upon user selection, send `user_input_result` message with selected option.
1. Return appropriate value.

Plugin Framework
----------------
1. Receive config, metrics, device info
1. React to USB messages, starting with 'status'
1. Manage exercise & video recording
1. Report results

### API
* XLMS.register({initialize, handle_device_status, handle_device_message})
    * initialize(configuration, metrics, device_id):
        * Called on plugin load.
        * configuration: Via XLMS
        * metrics: Via XLMS
        * device_id: USB device & vendor IDs for connected device
    * handle_device_status(status):
        * Called with device status once connection is established.
        * status: object returned by status USB message
    * handle_device_message(message_name, message_data):
        * Called for all subsequent messages from device.
        * message_name: Name of HID input report.
        * message_data: Content of message.
* XLMS.send_results(grade[, message_log])
    * grade: Returned to XLMS as is.
        * Use percentage for now.
        * In the future, XLMS will have plugin capability to interpret results data.
    * message_log:
        * Array of USB messages to return to XLMS.
        * If omitted, all non-status USB input messages since connection.

