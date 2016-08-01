/**
 * Created by riggs on 7/27/16.
 */

// https://developer.chrome.com/apps/app_runtime#event-onLaunched
chrome.app.runtime.onLaunched.addListener((launch_data) => {
  // If app was launched from XLMS.
  if (launch_data.id === "launch_exercise") {
    // https://developer.chrome.com/apps/app_window#method-create
    chrome.app.window.create("wrapper.html", {id: "wrapper", state: "fullscreen"}, (main_window) => {
      // Set `window.launch_url` in the created window.
      main_window.contentWindow.launch_url = launch_data.url;
    });
  } else {
    // App wasn't launched from XLMS.
    // TODO: Figure out bounds
    chrome.app.window.create("user_input.html", {id: "Launch_error"}, (error_window) => {
      error_window.contentWindow.error_message = "App much be launched from XLMS.";
      // TODO: Configure error buttons
    })
  }
});
