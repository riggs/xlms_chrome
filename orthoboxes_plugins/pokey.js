/**
 * Created by riggs on 8/15/16.
 */
'use strict';

import {session_data_promise} from "../src/XLMS";
import {View_Port, Status_Bar, Video_Recorder, session_data, orthobox} from "./common_components";

import React, {Component} from 'react';
import {render} from 'react-dom';
import {autorun} from "mobx";


orthobox.set_up = true;

class Pokey extends View_Port {
  render() {
    return (
      <div className="flex-container column">
        <Status_Bar {...this.props.session_data} {...this.state.viewport}/>
        <Video_Recorder {...this.props.session_data} {...this.state.viewport}/>
      </div>
    );
  }
}


session_data_promise.then(session_data => {
  render(
    <Pokey session_data={session_data} />,
    document.getElementById('content')
  );
});


