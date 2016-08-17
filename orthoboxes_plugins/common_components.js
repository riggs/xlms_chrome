/**
 * Created by riggs on 8/15/16.
 */
'use strict';

// App-wide DEBUG flag.
import DEBUG from "../src/debug_logger";

import {register_USB_message_handlers} from "../src/XLMS";

import React, {Component} from 'react';
import {findDOMNode} from 'react-dom';


export let session_data = {};


export let HID_message_handlers = {};
window.HID_message_handlers = HID_message_handlers;  // FIXME: DEBUG


export class View_Port extends Component {
  constructor(props) {
    super(props);
    this.state = {viewport: {window_width: window.innerWidth, window_height: window.innerHeight}};
    this.handle_resize = this.handle_resize.bind(this);
  }

  handle_resize() {
    this.setState({viewport: {window_width: window.innerWidth, window_height: window.innerHeight}});
  }

  componentDidMount() {
    window.addEventListener('resize', this.handle_resize);
    register_USB_message_handlers(HID_message_handlers);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handle_resize);
  }
}


export class Status_Bar extends Component {
  render() {
    return (
      <div id="status_bar" className="flex-item flex-container row">
        {/*<h2 id="student_name">{this.props.user_display_name}</h2>*/}
        <div className="flex-item">
          <h2 id="student_name">user_display_name</h2>
        </div>
        <div className="flex-item flex-container column">
          <div className="flex-item">
            {/*<h3 id="exercise_name">{this.props.exercise_name}</h3>*/}
            <h3 id="exercise_name">exercise_name</h3>
          </div>
          <div className="flex-item">
            {/*<h3 id="course_name">{this.props.course_name}</h3>*/}
            <h3 id="course_name">course_name</h3>
          </div>
        </div>
        <div className="flex-item">
          {/*<h2 id="timer">Elapsed Time: {this.props.timer}</h2>*/}
          <h2 className="flex-item" id="timer">Elapsed Time: timer</h2>
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


export class Video_Recorder extends Component {
  render() {
    return(
      <div className="column">
        <Video_Display />
        <button id="record">Begin Recording</button>
      </div>
    )
  }
}


