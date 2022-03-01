import { z } from "zod";
import deepEqual from "fast-deep-equal";

import { isZod } from "./util";

const isRecord = isZod(z.record(z.unknown()));

const Ref = z.object({
  $ref: z.string(),
});

const isRef = isZod(Ref);

const JsonSchema = z.object({
  $id: z.string(),
  $schema: z.string().optional(),
});

export type JsonSchema = z.infer<typeof JsonSchema>;

const isJsonSchema = isZod(JsonSchema);

const JsonSchemaArray = z.array(JsonSchema);

const isJsonSchemaArray = isZod(JsonSchemaArray);

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

const with$schema = (schema: JsonSchema, $schema?: string): JsonSchema =>
  $schema
    ? {
        ...schema,
        $schema,
      }
    : schema;

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

const extractRef = (schemas: JsonSchema[], $ref: string): JsonSchema[] => {
  const ref = resolveRef(schemas, $ref);
  if (!isRecord(ref)) {
    throw new Error(`ref not found while resovling ${$ref}`);
  }
  const $id = getExtractedRef($ref);
  const schema = with$schema(
    {
      $id,
      ...ref,
    },
    schemas[0].$schema,
  );
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
        with$schema(
          {
            $id: key,
            ...value,
          },
          schema.$schema,
        ),
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
          `#/properties/${key}`,
          `${key}#`,
        );
        if (!isJsonSchema(nextSchema)) {
          throw new Error(`not a JsonSchema`);
        }
        return nextSchema;
      }),
    schemas,
  );

const deepMap = (value: unknown, map: (value: unknown) => unknown): unknown => {
  const next = map(value);
  if (Array.isArray(next)) {
    return next.map((item) => deepMap(item, map));
  }
  if (typeof next === `object` && next !== null) {
    return Object.entries(next).reduce(
      (next, [key, value]) => ({
        ...next,
        [key]: deepMap(value, map),
      }),
      Object.create(null),
    );
  }
  return next;
};

const mergeTopLevelRefs = (schemas: JsonSchema[], k = 0): JsonSchema[] => {
  if (k >= schemas.length) {
    return schemas;
  }

  const { $id, $schema, ...schema } = schemas[k];
  void $schema;
  let dirty = false;
  const nextSchemas = deepMap(schemas, (value) => {
    if (dirty) {
      return value;
    }
    if (value !== schemas[k] && deepEqual(value, schema)) {
      dirty = true;
      return {
        $ref: `${$id}#`,
      };
    }
    return value;
  });

  if (!isJsonSchemaArray(nextSchemas)) {
    throw new Error(`not a JsonSchemaArray`);
  }

  if (dirty) {
    return mergeTopLevelRefs(nextSchemas, k);
  }

  return mergeTopLevelRefs(nextSchemas, k + 1);
};

export const flattenJsonSchema = (schema: JsonSchema): JsonSchema[] => {
  if (!isJsonSchemaObjectType(schema)) {
    throw new Error(`input schema is not an object type`);
  }

  return mergeTopLevelRefs(
    extractRefs(
      extractRootPropertiesRefs(schema, rootPropertiesToJsonSchemas(schema)),
    ),
  );
};
