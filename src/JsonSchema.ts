import { z } from "zod";

import { isZod } from "./util";

const isRecord = isZod(z.record(z.unknown()));

const Ref = z.object({
  $ref: z.string(),
});

const isRef = isZod(Ref);

const JsonSchema = z.object({
  $id: z.string(),
});

type JsonSchema = z.infer<typeof JsonSchema>;

const isJsonSchema = isZod(JsonSchema);

const JsonSchemaObjectType = z.object({
  type: z.literal(`object`),
  properties: z.record(z.unknown()),
});

type JsonSchemaObjectType = z.infer<typeof JsonSchemaObjectType>;

const isJsonSchemaObjectType = isZod(JsonSchemaObjectType);

const resolveRef = (schemas: JsonSchema[], $ref: string): unknown => {
  const [$id, path] = $ref.split(`#/`);
  const schema = schemas.find((schema) => schema.$id === $id);
  if (!schema) {
    throw new Error(`schema ${$id} not found while resolving ${$ref}`);
  }

  return path.split(`/`).reduce<unknown>((current, segment) => {
    if (!isRecord(current)) {
      throw new Error(
        `property ${segment} not found (current is not a record) while resolving ${$ref}`,
      );
    }
    return current[segment];
  }, schema);
};

const replaceRef = (
  input: unknown,
  prev$ref: string,
  next$ref: string,
): unknown => {
  if (isRef(input) && input.$ref.startsWith(prev$ref)) {
    return {
      $ref: input.$ref.replace(prev$ref, next$ref),
    };
  }
  if (Array.isArray(input)) {
    return input.map((item) => replaceRef(item, prev$ref, next$ref));
  }
  if (isRecord(input)) {
    return Object.entries(input).reduce(
      (output, [key, value]) => ({
        ...output,
        [key]: replaceRef(value, prev$ref, next$ref),
      }),
      Object.create(null),
    );
  }
  return input;
};

const getExtractedRef = ($ref: string): string =>
  $ref.replaceAll(/#|\//g, `_`).replaceAll(/_+/g, `_`);

const getRootPropertyId = ($id: string, key: string): string => `${$id}_${key}`;

export const translateRef = ($id: string, $ref: string): string => {
  if ($ref.startsWith(`${$id}#/properties/`)) {
    const [key, path] = $ref.split(`${$id}#/properties/`);
    return translateRef($id, `${getRootPropertyId($id, key)}#/${path}`);
  }
  return getExtractedRef($ref);
};

const extractRef = (schemas: JsonSchema[], $ref: string): JsonSchema[] => {
  const ref = resolveRef(schemas, $ref);
  if (!isRecord(ref)) {
    throw new Error(`ref not found while resovling ${$ref}`);
  }
  const $id = getExtractedRef($ref);
  const schema = {
    $id,
    ...ref,
  };
  return [
    schema,
    ...schemas.map((prevSchema) => {
      const nextSchema = replaceRef(prevSchema, $ref, `${$id}#`);
      if (!isJsonSchema(nextSchema)) {
        throw new Error(`not a JsonSchema`);
      }
      return nextSchema;
    }),
  ];
};

const findFirstNestedRef = (input: unknown): string | null => {
  if (isRef(input) && !input.$ref.endsWith(`#`)) {
    return input.$ref;
  }

  if (Array.isArray(input)) {
    for (const item of input) {
      const itemFirstNestedRef = findFirstNestedRef(item);
      if (itemFirstNestedRef) {
        return itemFirstNestedRef;
      }
    }
    return null;
  }

  if (isRecord(input)) {
    for (const value of Object.values(input)) {
      const valueFirstNestedRef = findFirstNestedRef(value);
      if (valueFirstNestedRef) {
        return valueFirstNestedRef;
      }
    }
    return null;
  }

  return null;
};

const extractRefs = (schemas: JsonSchema[]): JsonSchema[] => {
  const $ref = findFirstNestedRef(schemas);
  if ($ref) {
    return extractRefs(extractRef(schemas, $ref));
  }
  return schemas;
};

const rootPropertiesToJsonSchemas = (
  schema: JsonSchema & JsonSchemaObjectType,
): JsonSchema[] =>
  Object.entries(schema.properties).reduce<JsonSchema[]>(
    (schemas, [key, value]) => {
      if (!isRecord(value)) {
        throw new Error(
          `input schema property with key ${key} is not an object`,
        );
      }
      return [
        ...schemas,
        {
          $id: getRootPropertyId(schema.$id, key),
          ...value,
        },
      ];
    },
    [],
  );

const extractRootPropertiesRefs = (
  schema: JsonSchema & JsonSchemaObjectType,
  schemas: JsonSchema[],
): JsonSchema[] =>
  Object.keys(schema.properties).reduce<JsonSchema[]>(
    (schemas, key) =>
      schemas.map((prevSchema) => {
        const nextSchema = replaceRef(
          prevSchema,
          `${schema.$id}#/properties/${key}`,
          `${getRootPropertyId(schema.$id, key)}#`,
        );
        if (!isJsonSchema(nextSchema)) {
          throw new Error(`not a JsonSchema`);
        }
        return nextSchema;
      }),
    schemas,
  );

export const flattenJsonSchema = (schema: JsonSchema): JsonSchema[] => {
  if (!isJsonSchemaObjectType(schema)) {
    throw new Error(`input schema is not an object type`);
  }

  return extractRefs(
    extractRootPropertiesRefs(schema, rootPropertiesToJsonSchemas(schema)),
  );
};
