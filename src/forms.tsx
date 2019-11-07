import { Grid, Box, Button, Checkbox, FormControl, FormLabel, Input, Slider, SliderFilledTrack, SliderThumb, SliderTrack, Stack, Text, Heading } from '@chakra-ui/core';
import styled from '@emotion/styled';
import { Field, FieldInputProps, FieldProps, Formik, FormikProps, FormikHelpers } from 'formik';
import React from 'react';
import { FaMinus, FaPlus } from 'react-icons/fa';
import * as yup from 'yup';
import { keyBy } from 'lodash';


type ControlComponent = React.FC<{
  schema: yup.SchemaDescription,
  field: FieldInputProps<any>,
  form: FormikProps<unknown>
}>;
const controlComponents: Record<string, ControlComponent> = {
  input: ({ field, form }) => (
    <Input
      type="text"
      id={field.name}
      {...field}
    />
  ),
  slider: ({ schema, field, form }) => {
    const tests = keyBy(schema.tests, 'name');
    return (
      <Stack isInline mt={2}>
        <Box width="40px" mr={5}>
          <Input
            type="number"
            size="sm"
            variant="flushed"
            value={field.value}
            onBlur={() => {
              if (field.value === "") {
                (form.setFieldValue as any)(field.name as any, 0);
              }
            }}
            onChange={(event) => (form.setFieldValue as any)(field.name, event.target.value)}
          />
        </Box>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={(event) => {
            const amount = event.shiftKey ? (event.metaKey ? 100 : 10) : 1;
            (form.setFieldValue as any)(field.name, field.value - amount);
          }}
        >
          <Box as={FaMinus} />
        </Button>
        <Slider
          ml={1}
          id={field.name}
          value={field.value}
          name={field.name}
          min={(tests.min && tests.min.params as any).min}
          max={(tests.max && tests.max.params as any).max}
          step={(schema.meta as any).step}
          onChange={(value) => (form.setFieldValue as any)(field.name, value)}
        >
          <SliderTrack />
          <SliderFilledTrack />
          <SliderThumb />
        </Slider>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          ml={1}
          onClick={(event) => {
            const amount = event.shiftKey ? (event.metaKey ? 100 : 10) : 1;
            (form.setFieldValue as any)(field.name, field.value + amount);
          }}
        >
          <Box as={FaPlus} />
        </Button>
      </Stack>
    );
  },
  checkbox: ({ field, form }) => (
    <Box display="inline-block">
      <Checkbox
        id={field.name}
        size="lg"
        isChecked={field.value}
        onChange={event => {
          (form.setFieldValue as any)(field.name, event.target.checked);
        }}
      />
    </Box>
  ),
}

const FormControlField: React.FC<{
  fieldKey: string,
  schema: yup.SchemaDescription,
  props: FormikProps<any>,
}> = ({ fieldKey, schema, props }) => {
  return (
    <Field name={fieldKey}>
      {({ field, form, meta }: FieldProps) => {
        const fieldMeta = schema.meta as any || {};
        const ControlComponent = controlComponents[fieldMeta.component || 'input'];
        return (
          <FormControl key={fieldKey}>
            <FormLabel htmlFor={fieldKey} color="gray.300">
              {schema.label}
            </FormLabel>
            <ControlComponent schema={schema} field={field} form={props} />
            <Text color="red.300" mt={2}>
              {meta.error}
            </Text>
          </FormControl>
        );
      }}
    </Field>
  );
}

export const FormControls: React.FC<{
  schema: yup.ObjectSchema,
  initialValues: unknown,
  onSubmit: (values: unknown, actions: FormikHelpers<unknown>) => void,
}> = ({
  schema,
  initialValues,
  onSubmit
}) => {
  console.log(schema.describe());

  return (
    <Formik
      initialValues={initialValues}
      onSubmit={onSubmit}
      validationSchema={schema}
    >
      {props => (
        <form onSubmit={props.handleSubmit}>
          <Stack spacing={6} mt={6}>
            {Object.entries(schema.describe().fields).map(([key, schema ]) => {
              if (schema.type === 'object') {
                return (
                  <Box key={key}>
                    <Heading size="sm" mb={3}>
                      {schema.label}
                    </Heading>
                    <Grid templateColumns="repeat(2, 1fr)" gap={6}>
                      {Object.entries(schema.fields).map(([subkey, subschema]) => (
                        <Box w="100%" key={subkey}>
                          <FormControlField
                            fieldKey={`${key}.${subkey}`}
                            schema={subschema as any}
                            props={props}
                          />
                        </Box>
                      ))}
                    </Grid>
                  </Box>
                );
              }
              return (
                <Box w="100%" key={key}>
                  <FormControlField
                    fieldKey={key}
                    schema={schema as any}
                    props={props}
                  />
                </Box>
              );
            })}
          </Stack>
          <Button
            mt={4}
            variantColor="blue"
            isLoading={props.isSubmitting}
            type="submit"
          >
            Start Game
          </Button>
        </form>
      )}
    </Formik>
  )
}