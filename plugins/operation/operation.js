/**
 * Created by riggs on 6/30/16.
 */
"use strict";

import {session_data_promise, register_USB_message_handlers, exit, user_input, Window_Closed_Error, send_results} from "../../src/XLMS";


export let HID_message_handlers = {};
window.HID_message_handlers = HID_message_handlers;  // FIXME: DEBUG

let session = {
  log: {
    start: null,
    end: null,
    smiley: null,
    toilet: null,
    skull: null,
    dog: null,
    errors: []
  },
  id: null,
  configuration: null,
  metrics: null,
};
window.session = session;

let TIMER = {elapsed: 0, id: null, element: null};

function color(r, g, b, a = 1) {
  let obj = {r: r, g: g, b: b, a: a};

  obj.toString = () => {
    return "rgba(" + obj.r + "," + obj.g + "," + obj.b + "," + obj.a + ")";
  };

  return obj;
}

const GREEN = color(0, 0x80, 0);
const BLUE = color(0x00, 0x44, 0xFF);
const RED = color(0xFF, 0, 0);
const BLACK = color(0, 0, 0);


let Display = {
  canvas: null,
  context: null,
  initialize: (canvas => {
    let context = Display.context || canvas.getContext('2d');
    context.clearRect(0, 0, canvas.width, canvas.height);
    Display.canvas = canvas;
    Display.context = context;
  }),
  circle: (x, y, radius, color) => {
    let path = new Path2D();
    path.moveTo(x + radius, y);
    path.arc(x, y, radius, 0, 2 * Math.PI, false);
    return {
      path: path,
      color: color
    };
  },
  draw: (shape) => {
    Display.context.lineWidth = 2;
    Display.context.strokeStyle = BLACK.toString();
    Display.context.fillStyle = shape.color.toString();
    Display.context.stroke(shape.path);
    Display.context.fill(shape.path);
  },
  erase: (shape) => {
    let lineWidth = Display.context.lineWidth;
    Display.context.lineWidth = lineWidth + 1;
    Display.fader(shape, 0);
    Display.context.lineWidth = lineWidth;
  },
  fader: (shape, alpha) => {
    function faded(_color) {
      return color(_color.r, _color.g, _color.b, _color.a * (1 - alpha));
    }

    let old_composite = Display.context.globalCompositeOperation;
    Display.context.globalCompositeOperation = "destination-out";
    Display.context.strokeStyle = faded(BLACK).toString();
    Display.context.fillStyle = faded(shape.color).toString();
    Display.context.stroke(shape.path);
    Display.context.fill(shape.path);
    Display.context.globalCompositeOperation = old_composite;
  },
  flash: (shape) => {
    Display.draw(shape);
    let decay = 0.98;

    function fade() {
      Display.fader(shape, decay);
      decay -= 0.0014
    }

    let interval_ID = setInterval(fade, 100);
    //setTimeout(() => { decay -= 0.05 }, 2000);
    //setTimeout(() => { decay -= 0.05 }, 4000);
    setTimeout(() => {
      clearInterval(interval_ID);
      Display.erase(shape);
    }, 6000);
  },
  smiley: () => {
    let circle = Display.circle(285, 154, 30, BLUE);
    Display.flash(circle);
    return circle;
  },
  toilet: () => {
    let circle = Display.circle(386, 256, 30, BLUE);
    Display.flash(circle);
    return circle;
  },
  skull: () => {
    let circle = Display.circle(537, 350, 30, BLUE);
    Display.flash(circle);
    return circle;
  },
  dog: () => {
    let circle = Display.circle(696, 144, 30, BLUE);
    Display.flash(circle);
    return circle;
  },
  error: () => {

  }
};


function evaluate() {
  let {maximum, minimum} = session.metrics.elapsed_time;
  let time = (session.log.end - session.log.start) / 1000 | 0;
  if (time > maximum) {
    return 0;
  }
  if (session.log.errors.length > session.metrics.error_count.maximum) {
    return 0;
  }
  // Sum lengths of all errors.
  if (session.log.errors.reduce((prev, curr) => prev + curr.duration, 0) > session.metrics.error_length.maximum) {
    return 0;
  }
  // Don't obviously cheat.
  if (time < 1) {
    return 0;
  }
  // 60% is bare minimum passing, at max time allowed. 100% is a minimum time or less.
  return Math.min(1, 1 - (1 - 0.6) * (time - minimum) / (maximum - minimum));
}


async function end() {

  clearInterval(TIMER.id);

  let score = evaluate();

  let results = {
    session: session.log.id,
    device: 'Operation',
    start_time: session.log.start,
    elapsed_time: (session.log.end - session.log.start),
    results: session.log,
    success: score,
    configuration: session.configuration,
    metrics: session.metrics
  };

  send_results(results);

  try {
    await user_input(`You took ${Math.floor(results.elapsed_time / 1000)} seconds and made ${session.log.errors.length} errors.`, {Exit: exit});
  } catch (error) {
    if (error instanceof Window_Closed_Error) {
      exit();
    }
  }
}


HID_message_handlers.events = (timestamp, event) => {
  switch (event) {
    case 0:   // Start button pressed
      session.log.start = Date.now();
      TIMER.id = setInterval(() => {
        let elapsed = Math.floor((Date.now() - session.log.start) / 1000);
        if (elapsed > TIMER.elapsed) {
          TIMER.elapsed = elapsed;
          TIMER.element.textContent = `Elapsed Time: ${elapsed}`;
        }
      }, 50);
      break;
    case -1:  // Victory!
      session.log.end = Date.now();
      end();
      break;
    case -2:  // Failure :-(
      session.log.end = Date.now();
      end();
      break;
    case 1:   // Smiley removed
      session.log.smiley = message.data.value[0];
      Display.smiley();
      break;
    case 2:   // Toilet removed
      session.log.toilet = message.data.value[0];
      Display.toilet();
      break;
    case 3:   // Skull removed
      session.log.skull = message.data.value[0];
      Display.skull();
      break;
    case 4:   // Dog removed
      session.log.dog = message.data.value[0];
      Display.dog();
      break;
  }
};


HID_message_handlers.error = (timestamp, duration) => {
  session.log.errors.push({timestamp, duration});
  document.getElementById('error_count').textContent = `Errors: ${session.log.errors.length}`;
};


window.addEventListener('load', () => {

  register_USB_message_handlers(HID_message_handlers);

  Display.initialize(document.getElementById('display'));

  session_data_promise.then(session_data => {
    session.id = session_data.session_ID;
    session.configuration = session_data.configuration;
    session.metrics = session_data.metrics;

    document.getElementById('course_name').textContent = session_data.course_name;
    document.getElementById('exercise_name').textContent = session_data.exercise_name;
    document.getElementById('error_count').textContent = `Errors: ${session.log.errors.length}`;
    TIMER.element = document.getElementById('timer');
    TIMER.element.textContent = `Elapsed Time: ${TIMER.elapsed}`;

  });

  console.log("listening");

  window.addEventListener('message', (message) => {
    let wrapper_window = message.source;
    switch (message.data.name) {
      case "events":
        switch (message.data.value[1]) {
          case 42:  // Ready to start
            wrapper_window.postMessage({
              name: "ready"
            }, wrapper_window_origin);
            break;
        }
        break;
      case "results_request":
        // TODO: FIXME
        wrapper_window.postMessage({
          name: "results",
          results: {
            session: session.log.id,
            device: 'Operation: Operation Operation',
            start_time: session.log.start / 1000 | 0,
            elapsed_time: (session.log.end - session.log.start) / 1000 | 0,
            events: session.log,
            success: evaluate(),
            configuration: session.configuration,
            metrics: session.metrics
          }
        }, wrapper_window_origin);
        break;
    }
  })

});

window.Display = Display;