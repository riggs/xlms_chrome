/**
 * Created by riggs on 8/15/16.
 */
'use strict';

// App-wide DEBUG flag.
import DEBUG from "../src/debug_logger";

import {session_data_promise} from "../src/XLMS";
import {View_Port, Status_Bar, Video_Recorder, session_data, HID_message_handlers} from "./common_components";

import React, {Component} from 'react';
import {render} from 'react-dom';


class Peg extends Component {
  render() {
    let radius = Math.floor(Math.max(this.props.window_height, this.props.window_width) / 50);
    let stroke_width = 1
    return (
      <div className="flex-item centered">
        <svg height={2 * (radius + stroke_width)} width={2 * (radius + stroke_width)} className="centered">
          <circle cx={radius + stroke_width} cy={radius + stroke_width} r={radius}
                  fill={this.props.covered ? "white" : "blue"}
                  stroke="black" strokeWidth={stroke_width}/>
        </svg>
      </div>
    )
  }
}


class Peggy_Display extends Component {
  constructor(props) {
    super(props);
    this.state = {peg0: false, peg1: false, peg2: false, peg3: false, peg4: false, peg5: false}
  }

  componentWillMount() {
    HID_message_handlers.peg = (timestamp, location, state) => {
      DEBUG(`peg message received ${Date.now() - timestamp} ago: ${location} ${state ? '' : 'un'}covered.`);
      this.setState({[`peg${location}`]: Boolean(state)});
    }
  }

  render() {
    return (
      <div id="peggy_display" className="flex-item flex-container row">
        <div className="flex-item flex-container column">
          {[0, 1, 2].map(id => <Peg key={id} id={id} covered={this.state[`peg${id}`]} {...this.props}/>)}
        </div>
        <div className="flex-item flex-container column">
          {[3, 4, 5].map(id => <Peg key={id} id={id} covered={this.state[`peg${id}`]} {...this.props}/>)}
        </div>
      </div>
    )
  }
}


class Peggy extends View_Port {
  render() {
    return (
      <div className="flex-container column">
        <Status_Bar {...this.props.session_data} {...this.state.viewport}/>
        <div className="flex-container row">
          <Peggy_Display {...this.props.session_data} {...this.state.viewport}/>
          <Video_Recorder {...this.props.session_data} {...this.state.viewport}/>
        </div>
      </div>
    );
  }
}


// session_data_promise.then(session_data => {
  render(
    <Peggy session_data={session_data} />,
    document.getElementById('content')
  );
// });
