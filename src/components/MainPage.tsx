import React from 'react';
import { Box, Heading, List, ListItem, Flex, Text, PseudoBox, Stack, Link as HyperLink } from '@chakra-ui/core';
import { Link } from 'react-router-dom';
import * as ROUTE from '../routes';
import { newWorldPage } from '../routes';

const stars = require('../images/stars.png');

const PseudoBox$ = PseudoBox as any;

const MenuListItem = ({ to, children }) => (
  <PseudoBox$
    as={Link}
    to={to}
    display="block"
    color="blue.200"
    fontSize="lg"
    rounded="lg"
    borderWidth="1px"
    borderColor="blue.600"
    backgroundColor="rgba(26, 54, 93, 0.5)"
    p="5"
    _hover={{
      cursor: 'pointer',
      color: 'white',
      backgroundColor: 'blue.600',
    }}
  >
    {children}
  </PseudoBox$>
)
export const MainPage = () => (
  <Flex
    height="100vh"
    justify="center"
    backgroundImage={`url(${stars})`}
  >
    <Box
      width="500px"
      height="fit-content"
      mt="10rem"
      bg="rgba(23, 25, 35, 0.95)"
      borderWidth="1px"
      borderColor="gray.600"
      padding={10}
    >
      <Heading fontSize="6xl">Terra</Heading>

      <Text color="gray.500" mt={5} mb={8} fontSize="md">
        A strategy game with a procedurally generated world and society.
      </Text>

      <Stack spacing={5}>
        <Box><MenuListItem to={ROUTE.newWorldPage()}>New World</MenuListItem></Box>
        <Box><MenuListItem to={ROUTE.loadGamePage()}>Load Game</MenuListItem></Box>
      </Stack>
    </Box>
  </Flex>
)