import React from 'react';
import { render } from 'react-dom';
import { App } from './App';
import { ThemeProvider, ColorModeProvider, CSSReset } from "@chakra-ui/core";
import './style.css';
import customTheme from "./theme";
import emotionReset from 'emotion-reset';
import {Global, css} from '@emotion/core';

render((
  <ThemeProvider theme={customTheme}>
    <ColorModeProvider value="dark">
      <CSSReset />
      <App />
    </ColorModeProvider>
  </ThemeProvider>
), document.getElementById('root'));