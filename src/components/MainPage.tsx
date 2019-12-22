import React from 'react';
import { Box, Heading, List, ListItem, Flex, Text, PseudoBox, Stack, Link as HyperLink } from '@chakra-ui/core';
import { Link } from 'react-router-dom';
import * as ROUTE from '../routes';
import { newWorldPageRoute } from '../routes';
import { MenuContainer } from './MenuContainer';


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
  <MenuContainer>
    <Stack spacing={5}>
      <Box><MenuListItem to={ROUTE.newWorldPageRoute()}>New World</MenuListItem></Box>
      <Box><MenuListItem to={ROUTE.worldListPageRoute()}>Load World</MenuListItem></Box>
    </Stack>
  </MenuContainer>
)