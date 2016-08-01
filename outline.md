App Workflow
============

UI Window
---------
1. Launch.
    * Show error message if not launched via XLMS.
    * Open UI wrapper in fullscreen.
    * **TODO**: Make sure User Input window displays properly when app fullscreen.
    * Handled in background.js.
1. Get REST data from XLMS.
    * Endpoint URL encoded as query parameter in `launchData.url`.
    * Error if invalid session data.
1. Search for appropriate detected device.
    * Device ID via REST data.
    * Error if not found.
    * Error if multiples found.
    * Future work: UI to select device, match against REST data.
1. Configure video API.
1. Load webview.
    * URL from REST data.
    * Listen for `contentload` event.
1. Connect to device.
    1. Get HID report serialization feature report.
        * Error if unable to decode HID serialization.
    1. Set configuration feature report.
    1. Flag device as connected.

### Triggered Events
* On webview `contentload` event:
    1. Send configuration, metrics, device IDs.
        * From REST data and connected device.
    1. Add listener for `message` events:
        * user_input
        * results
    1. Flag webview as loaded.

* Once both webview has loaded and proper device is connected:
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
* user_input(message_string, {Option: callback})
    * message_string, required: displayed to the user
    * Options object, at least one key & cb required:
        * Keys are displayed to users as buttons.
        * Callback called based on user selection.
        * If user closes window instead, call last callback.

### Implementation
1. Send `user_input` message from plugin to app:
    * message_string
    * options array: user selectable options, keys from Options object.
1. Upon user selection, send `user_input_result` message with selected option
1. Call appropriate callback.

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

