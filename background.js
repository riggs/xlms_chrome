/**
 * Created by riggs on 7/27/16.
 */
'use strict';

// https://developer.chrome.com/apps/app_runtime#event-onLaunched
chrome.app.runtime.onLaunched.addListener((launch_data) => {
  // If app was launched from XLMS.
  if (launch_data.id === "launch_exercise") {
  // if (true) { // FIXME: DEBUG
    // https://developer.chrome.com/apps/app_window#method-create
    chrome.app.window.create("wrapper.html", {
      id: "wrapper",
      innerBounds: {width: window.screen.availWidth - 100, height: window.screen.availHeight - 100}
    }, (main_window) => {
      // Set `window.launch_url` in the created window.
      main_window.contentWindow.launch_url = launch_data.url;
    });
  } else {
    // App wasn't launched from XLMS.
    // TODO: Figure out bounds
    chrome.app.window.create("user_input.html", {id: "Launch_error"}, (error_window) => {
      error_window.contentWindow.message = "App much be launched from XLMS.";
      error_window.contentWindow.option_strings = ["Quit", "one", "two"];
      error_window.contentWindow.result = () => {
        error_window.close()
      };
    })
  }
});
