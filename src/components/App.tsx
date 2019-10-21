import React from 'react';
import { Router, Switch, Route } from 'react-router-dom';
import { createBrowserHistory } from "history"

import { MapViewer } from './MapViewer';
import { MainPage } from './MainPage';
import { NewWorldPage } from './NewWorldPage';
import { WorkerManager } from './WorkerManager';



export const history = createBrowserHistory();

export const App = () => (
  <Router history={history}>
    <Switch>
      <Route exact path="/" component={MainPage} />

      <WorkerManager>
        <Route path="/new-world" component={NewWorldPage} />
        <Route path="/new-game" component={NewWorldPage} />
        <Route path="/game" component={MapViewer} />
      </WorkerManager>
    </Switch>
  </Router>
)