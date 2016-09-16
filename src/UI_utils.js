/**
 * Created by riggs on 9/14/16.
 */
"use strict";


import React, {Component} from 'react';


export class View_Port extends Component {
  constructor(props) {
    super(props);
    this.state = {viewport: {window_width: window.innerWidth, window_height: window.innerHeight}};
    this.handle_resize = this.handle_resize.bind(this);
  }

  handle_resize() {
    this.setState({viewport: {window_width: window.innerWidth, window_height: window.innerHeight}});
  }

  componentDidMount() {
    window.addEventListener('resize', this.handle_resize);
  }

  componentWillUnmount() {
    window.removeEventListener('resize', this.handle_resize);
  }
}
