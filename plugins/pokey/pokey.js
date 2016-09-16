/**
 * Created by riggs on 8/15/16.
 */
'use strict';

import {Status_Bar, Video_Recorder, session_data, orthobox_state, Orthobox} from "../orthobox_components";

import React from 'react';
import {render} from 'react-dom';

// App-wide DEBUG flag.
import DEBUG from "../../src/debug_logger";

orthobox_state.set_up = true;
DEBUG(orthobox_state);

class Pokey extends Orthobox {
  render() {
    return (
      <div className="flex-container column">
        <Status_Bar {...this.props.session_data} {...this.state.viewport}/>
        <Video_Recorder {...this.props.session_data} {...this.state.viewport}/>
      </div>
    );
  }
}


render(
  <Pokey session_data={session_data}/>,
  document.getElementById('content')
);


