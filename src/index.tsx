import { ColorModeProvider, CSSReset, ThemeProvider } from "@chakra-ui/core";
import React from 'react';
import { render } from 'react-dom';
import { App } from './components/App';
import './style.css';
import customTheme from "./theme";

render((
  <ThemeProvider theme={customTheme}>
    <ColorModeProvider value="dark">
      <CSSReset />
      <App />
    </ColorModeProvider>
  </ThemeProvider>
), document.getElementById('root'));