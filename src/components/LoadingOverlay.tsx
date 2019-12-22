import React, { useEffect } from 'react';
import { Flex, Spinner } from '@chakra-ui/core';


export const LoadingOverlay = () => (
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