import React from 'react';
import { Text, Flex, Box, Stack, PseudoBox, Tooltip, Icon } from '@chakra-ui/core';


type FieldProps = {
  title?: string,
  desc?: string,
}

export const Field: React.FC<FieldProps> = ({ title, desc, children }) => {
  return (
    <PseudoBox
      as="label"
      color="gray.400"
      fontSize="sm"
      _hover={{
        cursor: 'pointer',
        color: 'gray.200'
      }}
    >
      <Flex mb={5}>
        <Box flex={1}>
          {title}
          <Tooltip aria-label={desc} label={desc} placement="top" hasArrow>
            <Icon m="3" name="help" aria-label="help" />
          </Tooltip>
        </Box>
        <Box flex={1}>
          {children}
        </Box>
      </Flex>
    </PseudoBox>
  );
}
