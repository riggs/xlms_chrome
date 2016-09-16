/**
 * Created by riggs on 8/15/16.
 */
'use strict';

// App-wide DEBUG flag.
import DEBUG from "../src/debug_logger";

import {View_Port} from "../src/UI_utils";
import {session_data_promise, register_USB_message_handlers, exit, user_input, Window_Closed_Error, send_results} from "../src/XLMS";

import React, {Component} from 'react';
import {findDOMNode} from 'react-dom';
import {observer} from "mobx-react";
import {observable, computed, action, toJS} from "mobx";


export let session_data = {}; // FIXME: DEBUG

export let HID_message_handlers = {};
window.HID_message_handlers = HID_message_handlers;  // FIXME: DEBUG


class Orthobox_State {
  static states = {
    waiting: 'waiting',
    ready: 'ready',
    exercise: 'exercise',
    finished: 'finished'
  };
  timer_interval = null;
  @observable session_data = {};
  @observable set_up = false;
  @observable state = Orthobox.states.waiting;
  @observable tool_state = null;
  // @observable recording = false;
  @observable start_time = null;
  @observable end_time = null;
  @observable timer = 0;
  @computed get elapsed_time() {
    if (this.start_time !== null && this.end_time !== null) {
      return this.end_time - this.start_time;
    } else {
      return null;
    }
  }
  @observable wall_errors = [];
  @observable drop_errors = [];
  @computed get error_count() {
    return this.wall_errors.length + this.drop_errors.length;
  }
  @observable pokes = [];
  raw_events = [];
  end_exercise() {
    this.end_time = Date.now();
    this.state = Orthobox.states.finished;
    clearInterval(this.timer_interval);
    Object.assign(this.session_data, this.results);
    // send_results(this.session_data);
    send_results(this.results);
    user_input(`You took ${Math.floor(this.results.elapsed_time / 1000)} seconds and made ${this.error_count} errors.`, {Exit: exit});
  }
  start_exercise() {
    this.start_time = Date.now();
    this.state = Orthobox.states.exercise;
    this.timer_interval = setInterval(() => {this.timer += 1}, 1000);
  }
  @computed get results() {
    let results = {};
    let {maximum, minimum} = this.session_data.metrics.elapsed_time;
    if (this.error_count > this.session_data.metrics.wall_error_count.maximum) {
      results.success = 0;
    } else {
      results.success = Math.max(0, Math.min(1, 1 - (1 - 0.6) * (Math.floor(this.elapsed_time / 1000) - minimum) / (maximum - minimum)));
    }
    results.start_time = this.start_time;
    results.elapsed_time = this.elapsed_time;
    results.results = {wall_errors: toJS(this.wall_errors), drop_errors: toJS(this.drop_errors)};
    return results;
  }
}


export let orthobox_state = new Orthobox_State();
window.orthobox = orthobox_state; // FIXME: DEBUG


function simplify_timestamp(timestamp) {
  /**
   * Simplify timestamp to second resolution for XLMS.
   */
  return Math.floor(timestamp/1000);
}


let TOOL_STATES = {
  0: 'out',
  1: 'in',
  2: 'unplugged'
};


export function save_raw_event(wrapped, name) {
  return function (...args) {
    DEBUG(`orthobox.raw_events.push({${name}: [${args}]});`);
    orthobox_state.raw_events.push({[name]: {...args}});
    return wrapped(...args);
  };
}


HID_message_handlers.wall_error = action(save_raw_event((timestamp, duration) => {
  // let timestamp = simplify_timestamp(timestamp);
  if (orthobox_state.state === Orthobox.states.exercise) {
    orthobox_state.wall_errors.push({timestamp, duration});
  }
}, 'wall_error'));


HID_message_handlers.drop_error = action(save_raw_event((timestamp, duration) => {
  // let timestamp = simplify_timestamp(timestamp);
  if (orthobox_state.state === Orthobox.states.exercise) {
    orthobox_state.drop_errors.push({timestamp});
  }
}, 'drop_error'));


HID_message_handlers.status = action(save_raw_event(async (timestamp, serial_number, ...status) => {

  // Big-endian.
  let byte1 = status[3];

  // If tool soldered incorrectly.
  if (byte1 & 1) {
    try {
      await user_input("Device Manufactured Incorrectly", {Quit: exit})
    } catch (error) {
      if (error instanceof Window_Closed_Error) {
        exit();
      }
    }
  }

  // Set tool state based on bits 2 & 3 in 1st byte.
  orthobox_state.tool_state = TOOL_STATES[(byte1 >> 1) & 0b11];

  while (orthobox_state.tool_state === 'unplugged') {
    try {
      await user_input("Tool Not Connected", {Retry: () => {}, Quit: exit})
    } catch (error) {
      if (error instanceof Window_Closed_Error) {
        exit();
      }
    }
  }

  if (orthobox_state.set_up && orthobox_state.tool_state === 'in') {
    orthobox_state.state = Orthobox.states.ready;
  }

}, 'status'));


HID_message_handlers.tool = action(save_raw_event((timestamp, state) => {
  orthobox_state.tool_state = TOOL_STATES[state];
  switch (state) {
    case 0:   // Out
      switch (orthobox_state.state) {
        case Orthobox.states.ready:
          if (orthobox_state.set_up) {
            orthobox_state.start_exercise();
          }
          break;
      }
      break;
    case 1:   // In
      switch (orthobox_state.state) {
        case Orthobox.states.waiting:
          if (orthobox_state.set_up) {
            orthobox_state.state = Orthobox.states.ready;
          }
          break;
      }
      break;
    case 2:
      switch (orthobox_state.state) {
        case Orthobox.states.ready:
          orthobox_state.state = Orthobox.states.waiting;
          break;
        case Orthobox.states.exercise:
          user_input("Error: Tool Disconnected. Aborting Exercise", {Quit: exit});
          break;
      }
      break;
  }
}, 'tool'));


HID_message_handlers.poke = action(save_raw_event((timestamp, location) => {
  if (orthobox_state.state === Orthobox.states.exercise) {
    orthobox_state.pokes.push({poke: {timestamp, location}});
    if (orthobox_state.pokes.length >= 10) {
      orthobox_state.end_exercise();
    }
  }
}, 'poke'));


export class Orthobox extends View_Port {
  componentDidMount() {
    register_USB_message_handlers(HID_message_handlers);
  }
}


@observer
export class Status_Bar extends Component {
  render() {
    let timer = null;
    let error_count = null;
    switch (orthobox_state.state) {
      case Orthobox.states.exercise:
      case Orthobox.states.finished:
        timer = `Elapsed Time: ${orthobox_state.timer}`;
        error_count = `Errors: ${orthobox_state.error_count}`;
        break;
      case Orthobox.states.ready:
        timer = `Elapsed Time: 0`;
        error_count = `Errors: 0`;
    }
    return (
      <div id="status_bar" className="flex-grow flex-container row">
        {/*<h2 id="student_name"> {this.props.user_display_name} </h2>*/}
        {/*<div className="flex-item">*/}
          {/*<h2 id="student_name"> user_display_name </h2>*/}
        {/*</div>*/}
        <div className="flex-grow flex-container column">
          <div className="flex-grow">
            <h3 id="course_name"> {this.props.course_name} </h3>
            {/*<h3 id="course_name"> course_name </h3>*/}
          </div>
          <div className="flex-grow">
            <h3 id="exercise_name"> {this.props.exercise_name} </h3>
            {/*<h3 id="exercise_name"> exercise_name </h3>*/}
          </div>
        </div>
        <div className="flex-grow">
          <h2 id="timer"> {timer} </h2>
        </div>
        <div className="flex-grow">
          <h3 id="error_count"> {error_count} </h3>
        </div>
      </div>
    )
  }
}


class Video_Display extends Component {
  constructor(props) {
    super(props);
    this.state = {src: null};
    this.streams = [];
    this.on_loaded_metadata = this.on_loaded_metadata.bind(this);
  }

  componentDidMount() {
    // FIXME: Basically this whole class, but especially, use https://github.com/webrtc/adapter
    navigator.webkitGetUserMedia(
      {video: true},
      (mediaStream => {
        this.streams.push(mediaStream);
        this.setState({src: window.URL.createObjectURL(mediaStream)});
      }),
      (error => {
        console.log(error);
      })
    )
  }

  componentWillUnmount() {
    this.streams.forEach(stream => stream.getTracks().forEach(track => track.stop()))
  }

  on_loaded_metadata(e) {
    DEBUG(e);
    findDOMNode(this).play();
  };

  render() {
    return (
      <video src={this.state.src} onLoadedMetadata={this.on_loaded_metadata}/>
    )
  }
}


// @observer
export class Video_Recorder extends Component {
  render() {
    return(
      <div className="column flex-grow">
        <Video_Display />
        {/*<button id="record" onClick={action(() => orthobox.recording = !orthobox.recording)}> {orthobox.recording ? 'Stop' : 'Start'} Recording </button>*/}
      </div>
    )
  }
}


session_data_promise.then(session_data => {
  Object.assign(orthobox_state.session_data, session_data);
});

