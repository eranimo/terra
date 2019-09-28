import React from 'react';
import { Box, Heading, List, ListItem } from '@chakra-ui/core';
import { Link } from 'react-router-dom';

export const MainMenu = () => (
  <Box>
    <Heading>Terra</Heading>

    <List>
      <ListItem>
        <Link to="/new">
          Create New World
        </Link>
      </ListItem>
      <ListItem>
        <Link to="/load">
          Load Game
        </Link>
      </ListItem>
    </List>
  </Box>
)