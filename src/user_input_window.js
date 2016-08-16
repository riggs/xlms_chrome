/**
 * Created by riggs on 7/29/16.
 *
 * Code run by the created user input window.
 */
'use strict';


// Close user input window if the main window is closed.
// window.creator.onClosed.addListener(() => chrome.app.window.current().close());

// TODO: Display shit.

function init() {
  document.getElementById('message').textContent = window.message;

}

window.addEventListener('load', init);
