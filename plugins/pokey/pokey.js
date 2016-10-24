/**
 * Created by riggs on 8/15/16.
 */
'use strict';

import {Status_Bar, Video_Recorder, orthobox, Orthobox_Component} from "../orthobox_components";

import React from 'react';
import {render} from 'react-dom';

// App-wide DEBUG flag.
import DEBUG from "../../src/debug_logger";

orthobox.set_up = true;
DEBUG(orthobox);

class Pokey extends Orthobox_Component {
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
  <Pokey session_data={orthobox.session_data}/>,
  document.getElementById('content')
);


