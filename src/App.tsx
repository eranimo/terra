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

export function App() {
  const screenRef = useRef();
  const minimapRef = useRef();
  const [manager, setManager] = useState(null);

  useEffect(() => {
    loadImages(IMAGES)
      .then(images => {
      const manager = new GameManager(
        screenRef.current,
        minimapRef.current,
        images,
      );
      console.log('manager', manager);
      setManager(manager);

      manager.options$.subscribe(() => {
        manager.generate();
      });
    });
  }, []);

  const { width, height } = useWindowSize();

  return (
    <div>
      {!manager && <div id="loading">Loading...</div>}
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
      {manager && <Controls manager={manager} />}
    </div>
  );
}