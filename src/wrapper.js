/**
 * Created by riggs on 7/31/16.
 */


let launch_url = window.launch_url;

// FIXME: Extract URI from launch URL using URIjs
let endpoint_URI = launch_url;

// TODO: get session data from XLMS via REST:
let {device_info, configuration, metrics} = XLMS_REST.get_session_data(enpoint_URI);
