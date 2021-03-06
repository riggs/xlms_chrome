/**
 * Created by riggs on 7/31/16.
 *
 * 'Magic' constant strings collected in one place.
 */

import {DEVEL} from "./utils";

// Query parameter used in launch url to specify REST API endpoint.
export let endpoint_query_parameter = "endpoint";

// Key names provided by REST API, used to normalize data for chrime.hid API.
export let vendor_ID_key = 'vendorID';
export let product_ID_key = 'deviceID';

export let app_origin = "chrome-extension://iojlopipcianjfbkkkfpffjmoooojhph";
if (DEVEL === "test") { app_origin = "chrome-extension://aaigjnokpeighgdafmffegkcchhjocpg"; }
else if (DEVEL) { app_origin = "chrome-extension://fckolomidkehbkflfenpencjcblnmoep"; }
