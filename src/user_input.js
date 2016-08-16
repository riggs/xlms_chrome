/**
 * Created by riggs on 7/29/16.
 *
 * Manages creation & communication with user input window.
 * Manages message passing with plugin API for user input.
 */
'use strict';


export class Window_Closed_Error extends Error {}


export function get_input(message, option_strings) {
  let pending = true;
  return new Promise((resolve, reject) => {
    chrome.app.window.create("user_input.html", {id: "user_input", frame: {type: "none"}}, (created_window) => {
      created_window.contentWindow.message = message;
      created_window.contentWindow.option_strings = option_strings;
      created_window.contentWindow.result = (result) => {
        if (pending) {
          pending = false;
          resolve(result);
        }
      };
      created_window.contentWindow.creator = chrome.app.window.current();
      created_window.onClosed.addListener(() => {
        if (pending) {
          pending = false;
          reject(new Window_Closed_Error("Window closed by user."));
        }
      })
    })
  });
}


export default async function (message, options) {
  return options[await get_input(message, Object.keys(options))];
}

