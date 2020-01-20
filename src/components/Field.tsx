import React from 'react';
import { Text, Flex, Box, Stack, PseudoBox, Tooltip, Icon } from '@chakra-ui/core';


type FieldProps = {
  key?: string,
  title?: string,
  desc?: string,
}

export const Field: React.FC<FieldProps> = ({ key, title, desc, children }) => {
  return (
    <PseudoBox
      color="gray.400"
      fontSize="sm"
      _hover={{
        cursor: 'pointer',
        color: 'gray.200'
      }}
    >
      <label htmlFor={key}>
        <Flex mb={5} align="center">
          <Box flex={1}>
            {title}
            <Tooltip aria-label={desc} label={desc} placement="top" hasArrow>
              ?
            </Tooltip>
          </Box>
          <Box flex={1}>
            {children}
          </Box>
        </Flex>
      </label>
    </PseudoBox>
  );
}
