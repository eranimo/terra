import React from 'react';
import { Flex, Box, Heading, Text } from '@chakra-ui/core';
const stars = require('../images/stars.png');


export const MenuContainer = ({ children }) => {
  return (
    <Flex
      height="100vh"
      alignItems="center"
      flexDir="column"
      backgroundImage={`url(${stars})`}
    >
      <Box width="500px" mt="10rem">
        <Heading fontSize="6xl">Terra</Heading>
        <Text color="gray.500" mt={5} mb={8} fontSize="md">
          A grand strategy game with a procedurally generated world.
        </Text>
      </Box>
      <Box
        width="500px"
        height="fit-content"
        bg="rgba(23, 25, 35, 0.95)"
        borderWidth="1px"
        borderColor="gray.600"
        rounded="lg"
        padding={10}
      >
        {children}
      </Box>
    </Flex>
  );
}
