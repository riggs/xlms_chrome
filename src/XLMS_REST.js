/**
 * Created by riggs on 7/31/16.
 *
 * API for sending & receiving data from the XLMS REST API.
 */
'use strict';


// External library imports.
import URI, {decode} from 'urijs';

// Internal imports.
import {DEBUG, exit} from "./utils";
import user_input, {Window_Closed_Error} from './user_input';
import {endpoint_query_parameter} from './constants';


export function parse_launch_URL(launch_url) {
  // Extract endpoint URL from launch URL.
  return decode(new URI(launch_url).search(true)[endpoint_query_parameter]);
}


export async function get_session_data(URL) {
  async function retrieve() {
    try {
      return await fetch(URL).then(response => response.json());
    } catch(error) {
      DEBUG(error);
      try {
        let result = await user_input(`Error: ${error.message}`, {
          Retry: async () => await retrieve(),
          Exit: exit
        });
        return await result();
      } catch (error) {
        if (error instanceof Window_Closed_Error) {
          exit();
        } else {
          throw error;
        }
      }
    }
  }
  let REST_data = await retrieve();
  DEBUG(REST_data);

  return {
    // user_display_name:      REST_data.name,
    id:                     REST_data.id,
    exercise_name:          REST_data.exercise,
    course_name:            REST_data.course,
    video_configuration: {
      url:                  REST_data.kurento_url,
      video_directory:      REST_data.kurento_video_directory
    },
    plugin_URL:             REST_data.interface,
    allowed_devices:        REST_data.hardware,
    metrics:                REST_data.metrics,
    configuration:          REST_data.configuration
  };
}


export async function send_results(URL, results) {
  let response = await fetch(URL, {
    method: 'put',
    headers: {
      "Content-type": "application/json; charset=UTF-8"
    },
    body: JSON.stringify(results)
  });
  // TODO: Error handling, via user_input.
  return response.ok;
}
