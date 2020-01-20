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
import { WorldManager } from '../WorldManager';

export const MapManagerContainer = createContainer(({ manager }: { manager: MapManager }) => {
  return useState(manager)[0];
});

(window as any)._ = require('lodash');

let mapManager: MapManager;

export function MapViewer({ worldManager }: { worldManager: WorldManager }) {
  const client = useContext(WorkerContext);
  const [isLoading, setLoading] = useState(true);
  const screenRef = useRef<HTMLCanvasElement>();
  const minimapRef = useRef<HTMLCanvasElement>();

  useEffect(() => {
    mapManager = new MapManager(
      client,
      screenRef.current,
      minimapRef.current,
    );

    const globeSubscription = worldManager.worldData$.subscribe(globe => mapManager.setWorldData(globe));

    setLoading(false);
    // console.log('manager', manager);

    return () => {
      mapManager.stopRendering();
      globeSubscription.unsubscribe();
    }
  }, [])

  const { width, height } = useWindowSize();

  return (
    <div>
      <canvas
        ref={screenRef}
        width={width}
        height={height}
        tabIndex={1}
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
            transform: 'rotate(180deg) scaleX(-1)',
            width: '360px',
            height: '180px',
          }}
          />
      </Box>
      {!isLoading && <MapManagerContainer.Provider manager={mapManager}>
        <TimeControls />
        <ViewControl />
        <CellInfo />
      </MapManagerContainer.Provider>}
    </div>
  );
}