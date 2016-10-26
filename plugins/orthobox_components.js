/**
 * Created by riggs on 8/15/16.
 */
'use strict';

// App-wide DEBUG flag.
import DEBUG, {DEVEL} from "../src/debug_logger";

import {View_Port} from "../src/UI_utils";
import {session_data_promise, register_USB_message_handlers, exit, user_input, Window_Closed_Error, send_results} from "../src/XLMS";

import React, {Component} from 'react';
import {findDOMNode} from 'react-dom';
import {observer} from "mobx-react";
import {observable, computed, action, runInAction, toJS} from "mobx";
import kurento_utils from "kurento-utils";
// import kurento_client from "kurento-client";
import "webrtc-adapter";
// let kurento_client = kurentoClient.KurentoClient;
if (DEVEL) { window.kurento_utils = kurento_utils; window.kurento_client = kurentoClient; }


export let HID_message_handlers = {};
if (DEVEL) { window.HID_message_handlers = HID_message_handlers; }

export const Orthobox_States = {
  waiting: 'waiting',
  ready: 'ready',
  exercise: 'exercise',
  finished: 'finished'
};

function no_op() {
  DEBUG("no_op");
}

function on_error(message) {
  if (message) {
    console.error(message)
  }
}

class Orthobox {
  timer_interval = null;
  @observable session_data = {};
  @observable set_up = false;
  @observable state = Orthobox_States.waiting;
  @observable tool_state = null;
  @observable recording = false;
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
  stop_recording = no_op;
  end_exercise() {
    this.stop_recording();
    this.end_time = Date.now();
    this.state = Orthobox_States.finished;
    clearInterval(this.timer_interval);
    Object.assign(this.session_data, this.results);
    // send_results(this.session_data);
    send_results(this.results);
    user_input(`You took ${Math.floor(this.results.elapsed_time / 1000)} seconds and made ${this.error_count} errors.`, {Exit: exit});
  }
  start_exercise() {
    if (!this.recording) {
      return user_input('Error: Exercise will not begin unless video is recording.', {OK: no_op});
    }
    this.start_time = Date.now();
    this.state = Orthobox_States.exercise;
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


export let orthobox = new Orthobox();
if (DEVEL) { window.orthobox = orthobox; }


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
    orthobox.raw_events.push({[name]: {...args}});
    return wrapped(...args);
  };
}


HID_message_handlers.wall_error = action(save_raw_event((timestamp, duration) => {
  // let timestamp = simplify_timestamp(timestamp);
  if (orthobox.state === Orthobox_States.exercise) {
    orthobox.wall_errors.push({timestamp, duration});
  }
}, 'wall_error'));


HID_message_handlers.drop_error = action(save_raw_event((timestamp, duration) => {
  // let timestamp = simplify_timestamp(timestamp);
  if (orthobox.state === Orthobox_States.exercise) {
    orthobox.drop_errors.push({timestamp});
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
  orthobox.tool_state = TOOL_STATES[(byte1 >> 1) & 0b11];

  while (orthobox.tool_state === 'unplugged') {
    try {
      await user_input("Tool Not Connected", {Retry: no_op, Quit: exit})
    } catch (error) {
      if (error instanceof Window_Closed_Error) {
        exit();
      }
    }
  }

  if (orthobox.set_up && orthobox.tool_state === 'in') {
    orthobox.state = Orthobox_States.ready;
  }

}, 'status'));


HID_message_handlers.tool = action(save_raw_event((timestamp, state) => {
  orthobox.tool_state = TOOL_STATES[state];
  switch (state) {
    case 0:   // Out
      switch (orthobox.state) {
        case Orthobox_States.ready:
          if (orthobox.set_up) {
            orthobox.state = Orthobox_States.waiting;   // Set to waiting in case video isn't recording.
            orthobox.start_exercise();  // State set in function.
          }
          break;
      }
      break;
    case 1:   // In
      switch (orthobox.state) {
        case Orthobox_States.waiting:
          if (orthobox.set_up) {
            orthobox.state = Orthobox_States.ready;
          }
          break;
      }
      break;
    case 2:
      switch (orthobox.state) {
        case Orthobox_States.ready:
          orthobox.state = Orthobox_States.waiting;
          break;
        case Orthobox_States.exercise:
          user_input("Error: Tool Disconnected. Aborting Exercise", {Quit: exit});
          break;
      }
      break;
  }
}, 'tool'));

HID_message_handlers.poke = action(save_raw_event((timestamp, location) => {
  if (orthobox.state === Orthobox_States.exercise) {
    orthobox.pokes.push({poke: {timestamp, location}});
    if (orthobox.pokes.length >= 10) {
      orthobox.end_exercise();
    }
  }
}, 'poke'));

export class Orthobox_Component extends View_Port {
  componentDidMount() {
    register_USB_message_handlers(HID_message_handlers);
  }
}

@observer
export class Status_Bar extends Component {
  render() {
    let timer = null;
    let error_count = null;
    switch (orthobox.state) {
      case Orthobox_States.exercise:
      case Orthobox_States.finished:
        timer = `Elapsed Time: ${orthobox.timer}`;
        error_count = `Errors: ${orthobox.error_count}`;
        break;
      case Orthobox_States.ready:
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

/**
 * Mirror video input back to user.
 *
 * Takes set_video_player and set_video_stream callbacks as props to return video node and video stream, respectively.
 */
class Video_Display extends Component {
  constructor(props) {
    super(props);
    this.state = {src: null};
    this.streams = [];
  }
  componentDidMount() {
    navigator.mediaDevices.getUserMedia({video: true})
      .then(mediaStream => {
        this.props.set_video_stream && this.props.set_video_stream(mediaStream);
        if (DEVEL) { window.video_stream = mediaStream; }
        this.streams.push(mediaStream);
        this.setState({src: window.URL.createObjectURL(mediaStream)});
      })
      .catch(on_error);
    this.props.set_video_player && this.props.set_video_player(findDOMNode(this));
  }
  componentWillUnmount() {
    this.streams.forEach(stream => stream.getTracks().forEach(track => track.stop()))
  }
  render() {
    return (
      <video src={this.state.src} autoPlay/>
    )
  }
}

@observer
export class Video_Recorder extends Component {
  constructor(props) {
    super(props);
    this.video_player = null;
    this.video_stream = null;
    this.set_video_player = this.set_video_player.bind(this);
    this.set_video_stream = this.set_video_stream.bind(this);
    this.record = this.record.bind(this);
  }
  set_video_player(video_player) {
    this.video_player = video_player;
  }
  set_video_stream(video_stream) {
    this.video_stream = video_stream;
  }
  record() {  // TODO: Wrap in try/catch and report error to user.
    if (orthobox.state != Orthobox_States.ready) {
      return user_input("Error: Recording will not begin until device is ready.", {OK: no_op})
    }
    // Nuke the existing media streams so that kurento-client can recreate them because passing them in as an doesn't actually work.
    this.video_stream.getTracks().forEach(track => track.stop());
    this.video_player.src = '';
    let session = orthobox.session_data;
    let options = {
      localVideo: this.video_player,
      // videoStream: this.video_stream,  // You would think this would work, but it doesn't, actually.
      // TODO: Additional options
    };
    DEBUG("options:", options);
    kurento_utils.WebRtcPeer.WebRtcPeerSendonly(options, function (error) {   // FIXME: remove or fix kurento-utils.
      if (error) { return on_error(error); }
      let webRTC_peer = this;  // kurento_utils binds 'this' to the callback, because this function is actually a pile of steaming shit wrapped in an object.
      DEBUG("webRTC_peer:", webRTC_peer);
      webRTC_peer.generateOffer((error, offer) => {
        if (error) { return on_error(error); }
        DEBUG("offer:", offer);
        kurentoClient.KurentoClient(session.video_configuration.url).then((client) => {
          DEBUG("got kurento_client:", client);
          client.create('MediaPipeline', (error, pipeline) => {
            DEBUG("pipeline:", pipeline);
            let elements =
              [
                {
                  type: 'RecorderEndpoint',
                  params: {uri: `file:///${session.video_configuration.video_directory}/${session.id}.webm`}
                },
                {type: 'WebRtcEndpoint', params: {}}
              ];
            pipeline.create(elements, (error, [recorder, webRTC]) => {
              if (error) { return on_error(error); }
              // Set ice callbacks
              webRTC_peer.on('icecandidate', (candidate) => {
                DEBUG("Local candidate:", candidate);
                candidate = kurentoClient.getComplexType('IceCandidate')(candidate);
                webRTC.addIceCandidate(candidate, on_error);
              });
              webRTC.on('OnIceCandidate', (event) => {
                DEBUG("Remote candidate:", event.candidate);
                webRTC_peer.addIceCandidate(event.candidate, on_error);
              });
              webRTC.processOffer(offer, (error, answer) => {
                if (error) { return on_error(error); }
                DEBUG("gathering candidates");
                webRTC.gatherCandidates(on_error);
                DEBUG("processing answer");
                webRTC_peer.processAnswer(answer);
              });
              DEBUG("connecting");
              client.connect(webRTC, webRTC, recorder, (error) => {
                if (error) { return on_error(error); }
                DEBUG("connected");
                recorder.record(action((error) => {
                  if (error) { return on_error(error); }
                  DEBUG("recording");
                  let recording = true;
                  orthobox.recording = true;
                  orthobox.stop_recording = () => {
                    if (recording) {
                      recording = false;
                      recorder.stop();
                      pipeline.release();
                      webRTC_peer.dispose();
                      options.localVideo.src = '';
                      // options.videoStream.getTracks().forEach(track => track.stop())
                    }
                  };
                }));
              })
            })
          });
        });
      });
    });
  }
  componentWillUnmount() {
    orthobox.stop_recording();
  }
  render() {
    return(
      <div className="column flex-grow">
        <Video_Display set_video_player={this.set_video_player} set_video_stream={this.set_video_stream} />
        <button id="record" onClick={this.record} hidden={orthobox.recording}> Record </button>
      </div>
    )
  }
}

session_data_promise.then(session_data => {
  Object.assign(orthobox.session_data, session_data);
});
