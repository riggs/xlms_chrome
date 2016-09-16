/**
 * Created by riggs on 7/29/16.
 *
 * Code run by the created user input window.
 */
'use strict';

import {View_Port} from "../src/UI_utils";

import React from 'react';
import {render} from 'react-dom';


class Input extends View_Port {
  render() {
    console.log(this.props.options);
    return (
      <div className="flex-container column">
        <div className="flex-grow flex-container centered">
          <h3 className="flex-grow centered"> {this.props.message} </h3>
        </div>
        <div className="flex-grow flex-container row spread">
          {this.props.options.map(option =>
            <button key={option} className="" onClick={() => {
              setTimeout(() => {chrome.app.window.current().close()}, 0);
              window.result(option);
            }}> {option} </button>
          )}
        </div>
      </div>
    )
  }
}


window.addEventListener('load', () => {
  render(
    <Input message={window.message} options={window.option_strings} />,
    document.getElementById('content')
  );
});
