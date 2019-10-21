import { Box, Flex, Spinner } from '@chakra-ui/core';
import React, { useEffect, useRef, useState, useContext } from 'react';
import { useWindowSize } from 'react-use';
import { MapManager } from '../MapManager';
import { loadImages } from '../utils';
import { CellInfo } from './CellInfo';
import { Controls } from './Controls';
import { ViewControl } from './ViewControl';
import createContainer from 'constate';
import { TimeControls } from './TimeControls';
import { WorkerContext } from './WorkerManager';
import { GlobeManager } from '../GlobeManager';

export const MapManagerContainer = createContainer(({ manager }: { manager: MapManager }) => {
  return useState(manager)[0];
});

(window as any)._ = require('lodash');

const IMAGES = {
  stars: require('../images/stars2.png')
};

let manager: MapManager;

export function MapViewer({ globeManager }: { globeManager: GlobeManager }) {
  const client = useContext(WorkerContext);
  const [isLoading, setLoading] = useState(true);
  const screenRef = useRef();
  const minimapRef = useRef();

  useEffect(() => {
    loadImages(IMAGES).then(images => {
      manager = new MapManager(
        client,
        screenRef.current,
        minimapRef.current,
        images,
      );

      const globeSubscription = globeManager.globe$.subscribe(globe => manager.setGlobe(globe));

      setLoading(false);
      console.log('manager', manager);

      return () => {
        globeSubscription.unsubscribe();
      }
    });
  }, []);


  const { width, height } = useWindowSize();
  return (
    <div>
      <canvas
        ref={screenRef}
        width={width}
        height={height}
      />
      <Box
        bg="black"
        borderWidth="1px"
        borderColor="gray.600"
        position="fixed"
        right={0}
        bottom={0}
        width={360}
        height={180}
      >
        <canvas
          ref={minimapRef}
          width={360 * 5}
          height={180 * 5}
          style={{
            transform: 'rotate(180deg)',
            width: '360px',
            height: '180px',
          }}
          />
      </Box>
      {!isLoading && <MapManagerContainer.Provider manager={manager}>
        <TimeControls />
        <ViewControl />
        <CellInfo />
      </MapManagerContainer.Provider>}
    </div>
  );
}