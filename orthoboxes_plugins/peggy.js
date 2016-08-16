/**
 * Created by riggs on 8/15/16.
 */
'use strict';

import {session_data_promise} from "../lib/XLMS";

import {Component} from 'react';
import {render} from 'react-dom';


class Peggy_Display extends Component {
  render() {
    return (
      <div>

      </div>
    )
  }
}


class Peggy extends Component {
  render() {
    return (
      <div> {/* TODO: Column */}
        <Status_Bar />
        <div> {/* TODO: Row */}
          <Peggy_Display/>
          <Video_Recorder />
        </div>
      </div>
    );
  }
}


session_data_promise.then(session_data => {
  render(
    <Peggy session_data={session_data} />,
    document.getElementById('content')
  );
});
