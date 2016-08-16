/**
 * Created by riggs on 8/15/16.
 */
'use strict';

import {session_data_promise} from "../lib/XLMS";
import {Status_Bar, Video_Recorder} from "./common_components";

import {Component} from 'react';
import {render} from 'react-dom';


class Pokey extends Component {
  render() {
    return (
      <div>
        <Status_Bar />
        <Video_Recorder />
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
