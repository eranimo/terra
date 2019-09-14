import React, { useEffect, useRef, useState } from 'react';
import { useWindowSize } from 'react-use';
import { Controls } from './components/Controls';
import { EDrawMode, EMapMode, IDrawOptions, IGlobeOptions } from './types';
import { loadImages } from './utils';
import { GameManager } from './GameManager';


(window as any)._ = require('lodash');

const IMAGES = {
  stars: require('./images/stars2.png')
};

let manager: GameManager;

export function App() {
  const screenRef = useRef();
  const minimapRef = useRef();
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    loadImages(IMAGES).then(images => {
      manager = new GameManager(
        screenRef.current,
        minimapRef.current,
        images,
      );
      console.log('manager', manager);
      setLoading(false);
    });
  }, []);

  const { width, height } = useWindowSize();

  return (
    <div>
      {isLoading && <div id="loading">Loading...</div>}
      <canvas
        ref={screenRef}
        width={width}
        height={height}
      />
      <canvas
        className="minimap"
        ref={minimapRef}
        width={360 * 5}
        height={180 * 5}
      />
      {!isLoading && <Controls manager={manager} />}
    </div>
  );
}