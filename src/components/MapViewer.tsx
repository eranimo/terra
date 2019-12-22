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

function getCursorPosition(event: React.MouseEvent, element: HTMLElement) {
  const { left, top } = element.getBoundingClientRect();
  const { clientX, clientY } = event;
  const mouseX = clientX - left;
  const mouseY = clientY - top;
  return [mouseX, mouseY];
}

export function MapViewer({ globeManager }: { globeManager: GlobeManager }) {
  const client = useContext(WorkerContext);
  const [isLoading, setLoading] = useState(true);
  const screenRef = useRef<HTMLCanvasElement>();
  const minimapRef = useRef<HTMLCanvasElement>();

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

  const [downPosition, setDownPosition] = useState({ x: 0, y: 0 });
  const [hoverPosition, setHoverPosition] = useState({ x: 0, y: 0 });
  const [isMouseDown, setMouseDown] = useState(false);
  const [isDragging, setDragging] = useState(false);
  const [tooltip, setTooltip] = useState(null);

  const handleMouseDown = (event: React.MouseEvent) => {
    if (!manager) return;
    setDownPosition({ x: event.clientX, y: event.clientY });
    setMouseDown(true);
  };

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!manager) return;

    if (!isDragging) {
      const [cursorX, cursorY] = getCursorPosition(event, screenRef.current);
      setHoverPosition({ x: cursorX, y: cursorY });
      manager.handleMapHover(cursorX, cursorY).then(setTooltip);
    } else {
      setTooltip(null);
    }

    if (!isMouseDown) {
      return;
    }

    const distance = Math.sqrt(
      Math.pow(downPosition.x - event.clientX, 2) +
      Math.pow(downPosition.y - event.clientY, 2)
    );

    if (distance > 10) {
      setDragging(true);
    }
  };

  const handleMouseUp = (event: React.MouseEvent) => {
    if (!manager) return;
    setDragging(false);
    setMouseDown(false);
    const distance = Math.sqrt(
      Math.pow(downPosition.x - event.clientX, 2) +
      Math.pow(downPosition.y - event.clientY, 2)
    );
    if (distance > 10) return;
    
    const [cursorX, cursorY] = getCursorPosition(event, screenRef.current);
    manager.handleMapClick(cursorX, cursorY);
  };

  const handleMouseLeave = () => {
    setTooltip(null);
  }

  useEffect(() => {
    document.addEventListener('mouseleave', event => {
      if (event.toElement === null && event.relatedTarget === null) {
        setTooltip(null);
      }
    }, false);
  }, []);

  const { width, height } = useWindowSize();
  const cursor = isDragging ? 'move' : 'default';

  return (
    <div>
      <canvas
        ref={screenRef}
        width={width}
        height={height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onMouseOut={handleMouseLeave}
        style={{ cursor }}
      />
      {tooltip && <Box
        p={2}
        position="fixed"
        left={hoverPosition.x + 5}
        top={hoverPosition.y + 5}
        bg="rgba(23, 25, 35, 0.75)"
        pointerEvents="none"
      >
        {tooltip}
      </Box>}

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