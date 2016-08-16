/**
 * Created by riggs on 8/15/16.
 */
'use strict';

// App-wide DEBUG flag.
import DEBUG from "../src/debug_logger";


import {Component} from 'react';


export class Status_Bar extends Component {
  render() {
    return(
      <div> {/* Row */}
        <h2 id="student_name">{this.props.user_display_name}</h2>
        <div> {/* Column */}
          <h3 id="exercise_name">{this.props.exercise_name}</h3>
          <h3 id="course_name">{this.props.course_name}</h3>
        </div>
        <h2 id="timer">Elapsed Time: {this.props.timer}</h2>
      </div>
    )
  }
}


export class Video_Recorder extends Component {
  render() {
    return(
      <div> {/* Column */}
        <Video_Display />
        <button id="record">Begin Recording</button>
      </div>
    )
  }
}


