UI Window
=========
1. Launch.
    * Show error message if not launched via XLMS.
    * Open UI wrapper in fullscreen.
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

Triggered Events
----------------        
* On webview `contentload` event:
    1. Send configuration, metrics, device IDs.
        * From REST data and connected device.
    1. Add listener for `message` events for error handling.
    1. Flag webview as loaded.

* Once both webview has loaded and proper device is connected:
    1. Send timestamp.
    1. Start receive polling loop.
        * Pass all USB messages to plugin via [`webview.contentWindow.postMessage` API](https://developer.chrome.com/apps/tags/webview#type-ContentWindow).
