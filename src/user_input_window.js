/**
 * Created by riggs on 7/29/16.
 *
 * Code run by the created user input window.
 */
'use strict';


import React, {Component} from 'react';
import {render} from 'react-dom';


class Input extends Component {
  render() {
    console.log(this.props.options);
    return (
      <div className="flex-container column">
        <div className="flex-item flex-container centered">
          <h3 className="flex-item centered"> {this.props.message} </h3>
        </div>
        <div className="flex-item flex-container row spread">
          {this.props.options.map(option =>
            <button key={option} className="flex-item" onClick={() => {
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
