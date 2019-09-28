import React from 'react';
import { Router, Switch, Route } from 'react-router-dom';
import { MapViewer } from './MapViewer';
import { MainMenu } from './MainMenu';
import { createBrowserHistory } from "history"



export const history = createBrowserHistory();

export const App = () => (
  <Router history={history}>
    <Switch>
      <Route exact path="/" component={MainMenu} />
      <Route path="/new" component={MapViewer} />
      <Route path="/load" component={MapViewer} />
    </Switch>
  </Router>
)