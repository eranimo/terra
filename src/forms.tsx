import { Box, Button, Checkbox, FormControl, FormLabel, Grid, Heading, Input, Slider, SliderFilledTrack, SliderThumb, SliderTrack, Stack, Text } from '@chakra-ui/core';
import { keyBy } from 'lodash';
import React from 'react';
import { FaMinus, FaPlus } from 'react-icons/fa';
import * as yup from 'yup';
import { Form, Field, FormRenderProps, FieldProps, FieldInputProps } from 'react-final-form';


type ControlComponent = React.FC<{
  schema: yup.SchemaDescription,
  field: FieldInputProps<any, any>,
  form: FormRenderProps,
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
                field.onChange(0);
              }
            }}
            onChange={(event) => field.onChange(event.target.value)}
          />
        </Box>
        <Button
          type="button"
          size="xs"
          variant="ghost"
          onClick={(event) => {
            const amount = event.shiftKey ? (event.metaKey ? 100 : 10) : 1;
            field.onChange(field.value - amount);
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
          onChange={(value) => field.onChange(value)}
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
            field.onChange(field.value + amount);
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
          field.onChange(event.target.checked);
        }}
      />
    </Box>
  ),
}

const FormControlField: React.FC<{
  fieldKey: string,
  schema: yup.Schema<any>,
  desc: yup.SchemaDescription,
  props: FormRenderProps,
}> = ({ fieldKey, desc, schema, props }) => {
  return (
    <Field
      name={fieldKey}
      validate={async value => {
        try {
          await schema.validate(value);
        } catch (err) {
          return err.errors[0];
        }
      }}
    >
      {({ input, meta }) => {
        const fieldMeta = desc.meta as any || {};
        const ControlComponent = controlComponents[fieldMeta.component || 'input'];
        return (
          <FormControl key={fieldKey}>
            <FormLabel htmlFor={fieldKey} color="gray.300">
              {desc.label}
            </FormLabel>
            <ControlComponent schema={desc} field={input} form={props} />
            <Text color="red.300" mt={2}>
              {meta.touched && meta.error}
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
  onSubmit: (values: any) => void,
}> = ({
  schema,
  initialValues,
  onSubmit
}) => {
  console.log(schema, schema.describe());

  return (
    <Form
      initialValues={initialValues}
      onSubmit={onSubmit}
    >
      {props => (
        <form onSubmit={props.handleSubmit}>
          <Stack spacing={6} mt={6}>
            {Object.entries(schema.describe().fields).map(([key, desc ]: [string, yup.SchemaDescription]) => {
              if (desc.type === 'object') {
                return (
                  <Box key={key}>
                    <Heading size="sm" mb={3}>
                      {schema.label}
                    </Heading>
                    <Grid templateColumns="repeat(2, 1fr)" gap={6}>
                      {Object.entries(desc.fields).map(([subkey, subdesc]: [string, yup.SchemaDescription]) => {
                        const fieldSchema = (schema as any).fields[key].fields[subkey];
                        return (
                          <Box w="100%" key={subkey}>
                            <FormControlField
                              fieldKey={`${key}.${subkey}`}
                              schema={fieldSchema}
                              desc={subdesc}
                              props={props}
                            />
                          </Box>
                        );
                      })}
                    </Grid>
                  </Box>
                );
              }
              return (
                <Box w="100%" key={key}>
                  <FormControlField
                    fieldKey={key}
                    schema={schema}
                    desc={desc}
                    props={props}
                  />
                </Box>
              );
            })}
          </Stack>
          <Button
            mt={4}
            variantColor="blue"
            type="submit"
          >
            Start Game
          </Button>
        </form>
      )}
    </Form>
  )
}