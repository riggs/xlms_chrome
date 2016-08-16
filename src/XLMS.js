/**
 * Created by riggs on 7/31/16.
 *
 * API for plugins.
 */
"use strict";


// App-wide DEBUG flag.
import DEBUG from "./debug_logger";


export class Window_Closed_Error extends Error {}


let user_input_port = null;
let HID_message_port = null;
let admin_message_port = null;
let HID_handler = {func: (event) => HID_handler.cache.push(event.data), cache: []};


let source_window = null;

// FIXME: Smartly handle multiple simultaneous user_input requests.
let respond = null;


function send(request) {
  return new Promise((resolve, reject) => {
    user_input_port.postMessage(request);
    respond = resolve;
  });
}


function handle_user_input_response(event) {
  if (respond !== null) {
    let {result} = event.data;
    DEBUG(`respond(${result})`);
    respond(result);
    respond = null;
  } else {
    console.log(event);
  }
}


export async function user_input(message, options) {
  let request = {message: message, option_strings: Object.keys(options)};

  let result = await send(request);
  if (result === null) {
    throw new Window_Closed_Error();
  } else {
    return options[result];
  }
}


export function user_input_with_callback(message, options, callback) {
  user_input(message, options).then(callback);
}


export function register_USB_message_handler(handler) {
  if (HID_message_port !== null) {
    // Call the handler with all the cached messages.
    while (HID_handler.cache.length) {
      handler(HID_handler.cache.shift())
    }
    // Once caught up, replace caching message handler.
    HID_message_port.onmessage = (event) => handler(event.data);
  } else {
    // If this function is called before the message port is received, use this handler from the start.
    HID_handler.func = handler;
  }
}


function admin_message_handler(message) {
  DEBUG(`admin message: ${message}`);
}


export let session_data_promise = new Promise((resolve, reject) => {
  window.addEventListener('message', (event) => {
    if (event.data.type === "initialization") {
      DEBUG(event);
      source_window = event.source;
      [user_input_port, HID_message_port, admin_message_port] = event.ports;
      user_input_port.onmessage = handle_user_input_response;
      HID_message_port.onmessage = (event) => HID_handler.func(event.data);
      admin_message_port.onmessage = admin_message_handler;

      resolve(event.data.session_data);
    } else {
      console.log(event);
    }
  });
});


export function send_results(results) {
  DEBUG(`admin_message_port.postMessage({type: "results", ${results}});`);
  admin_message_port.postMessage({type: "results", results});
}


export function exit() {
  admin_message_port.postMessage({type: "exit"})
}