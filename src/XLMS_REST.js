/**
 * Created by riggs on 7/31/16.
 *
 * API for sending & receiving data from the XLMS REST API.
 */


// External library imports.
import * as URI from 'urijs';

// Internal imports.
import {endpoint_query_parameter} from './constants';
import user_input from './user_input';


export function parse_launch_URL() {
  // Extract endpoint URI from launch URL.
  return URI.parseQuery(URI.parse(launch_url).query)[endpoint_query_parameter];
}

export function get_session_data(URI) {
  // TODO: Fetch from API.
  let REST_data = {};

  // TODO: Error handling, via user_input.
  return {
    exercise_name:          REST_data.exercise,
    course_name:            REST_data.course,
    video_configuration: {
      url:                  REST_data.kurento_url,
      video_directory:      REST_data.kurento_video_directory
    },
    plugin_URL:             REST_data.interface,
    allowed_devicse:        REST_data.hardware,
    metrics:                REST_data.metrics,
    configuration:          REST_data.configuration
  };
}


export function send_results(URI) {

}
