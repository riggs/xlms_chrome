/**
 * Created by riggs on 8/15/16.
 */
'use strict';


import {
  Status_Bar, Video_Recorder, HID_message_handlers, orthobox,
  save_raw_event, Orthobox_States, Orthobox_Component
} from "../orthobox_shared_components";

import React, {Component} from 'react';
import {render} from 'react-dom';
import {observer} from "mobx-react";
import {observable, action} from "mobx";


let pegs = observable(new Array(6));
pegs.fill(true);

function all_left() {
  return pegs.slice(0, 3).every(peg => peg)
}

function all_right() {
  return pegs.slice(3, 6).every(peg => peg)
}

let task = 'ltr';

HID_message_handlers.peg = action(save_raw_event((timestamp, location, state) => {
  pegs[location] = Boolean(state);
  switch (orthobox.state) {
    case Orthobox_States.waiting:
    case Orthobox_States.ready:
      if (all_left()) {
        orthobox.set_up = true;
      }
      break;
    case Orthobox_States.exercise:
      if (task === 'ltr' && all_right()) {
        task = 'rtl';
      } else if (task === 'rtl' && all_left()) {
        orthobox.end_exercise();
      }
  }
}, "peg"));


let wrapped_status_func = HID_message_handlers.status;
HID_message_handlers.status = action( (timestamp, serial_number, ...status) => {
  // Big-endian
  let byte2 = status[2];
  for(let i=0; i < 6; i++) {
    let mask = 2**i;
    // Assign initial peg status.
    pegs[i] = (byte2 & mask)
  }
  // If first 3 pegs are covered.
  if (all_left()) {
    orthobox.set_up = true;
  }
  wrapped_status_func(timestamp, serial_number, ...status);
});


@observer
class Peg extends Component {
  render() {
    let radius = Math.floor(Math.max(this.props.window_height, this.props.window_width) / 50);
    let stroke_width = 1;
    let coordinate = radius + stroke_width;
    if (!pegs[this.props.id]) {radius = Math.floor(0.9 * radius)}
    return (
      <div className="flex-grow centered">
        <svg height={2 * coordinate} width={2 * coordinate} className="flex-grow centered">
          <circle cx={coordinate} cy={coordinate} r={radius}
                  fill={pegs[this.props.id] ? "lightgrey" : "#AEBFFF"}
                  stroke="black" strokeWidth={stroke_width}/>
        </svg>
      </div>
    )
  }
}


class Peggy_Display extends Component {
  render() {
    return (
      <div id="peggy_display" className="flex-grow flex-container row">
        <div className="flex-grow flex-container column">
          {[0, 1, 2].map(id => <Peg key={id} id={id} {...this.props.viewport}/>)}
        </div>
        <div className="flex-grow flex-container column">
          {[3, 4, 5].map(id => <Peg key={id} id={id} {...this.props.viewport}/>)}
        </div>
      </div>
    )
  }
}


class Peggy extends Orthobox_Component {
  render() {
    return (
      <div className="flex-container column">
        <Status_Bar viewport={this.state.viewport} {...this.props}/>
        <div className="flex-container row">
          <Peggy_Display viewport={this.state.viewport} {...this.props}/>
          <Video_Recorder viewport={this.state.viewport} {...this.props}/>
        </div>
      </div>
    );
  }
}


render(
  <Peggy orthobox={orthobox}/>,
  document.getElementById('content')
);
