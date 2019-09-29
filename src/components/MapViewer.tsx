import { Box, Flex, Spinner } from '@chakra-ui/core';
import React, { useEffect, useRef, useState } from 'react';
import { useWindowSize } from 'react-use';
import { MapManager } from '../MapManager';
import { loadImages } from '../utils';
import { CellInfo } from './CellInfo';
import { Controls } from './Controls';
import { ViewControl } from './ViewControl';


const LoadingOverlay = () => (
  <Flex
    justify="center"
    align="center"
    position="fixed"
    zIndex={10000}
    left={0} right={0} top={0} bottom={0}
  >
    <Spinner size="xl" />
  </Flex>
);


(window as any)._ = require('lodash');

const IMAGES = {
  stars: require('../images/stars2.png')
};

let manager: MapManager;

export function MapViewer() {
  const screenRef = useRef();
  const minimapRef = useRef();
  const [isLoading, setLoading] = useState(true);

  useEffect(() => {
    loadImages(IMAGES).then(images => {
      manager = new MapManager(
        screenRef.current,
        minimapRef.current,
        images,
        () => setLoading(true),
        () => setLoading(false),
      );
      console.log('manager', manager);
    });
  }, []);

  const { width, height } = useWindowSize();
  return (
    <div>
      {isLoading && <LoadingOverlay />}
      <canvas
        ref={screenRef}
        width={width}
        height={height}
      />
      {!isLoading && <ViewControl manager={manager} />}
      <Box
        bg="black"
        borderWidth="1px"
        borderColor="gray.600"
        position="fixed"
        right={0}
        bottom={0}
        width={360}
        height={180}
        style={{
          visibility: isLoading ? 'hidden' : 'visible'
        }}
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
      {!isLoading && <Controls manager={manager} />}
      {!isLoading && <CellInfo manager={manager} />}
    </div>
  );
}