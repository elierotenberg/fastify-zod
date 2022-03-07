import { z, ZodType } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

import { Models, SchemaKeyOrDescription } from "./Models";
export type BuildJsonSchemasOptions = {
  readonly $id?: string;
  readonly target?: `jsonSchema7` | `openApi3`;
};

type $ref<M extends Models> = (key: SchemaKeyOrDescription<M>) => {
  readonly $ref: string;
  readonly description?: string;
};

type JsonSchema = {
  readonly $id: string;
};

export type BuildJsonSchemasResult<M extends Models> = {
  readonly schemas: JsonSchema[];
  readonly $ref: $ref<M>;
};

/**
 * @deprecated
 */
export const buildJsonSchema = <T>(
  Type: ZodType<T>,
  schemaKey: string,
): JsonSchema =>
  buildJsonSchemas({ [schemaKey]: Type }, { $id: schemaKey }).schemas[0];

export const buildJsonSchemas = <M extends Models>(
  models: M,
  opts: BuildJsonSchemasOptions = {},
): BuildJsonSchemasResult<M> => {
  const zodSchema = z.object(models);

  const $id = opts.$id ?? `Schema`;

  const zodJsonSchema = zodToJsonSchema(zodSchema, {
    target: opts.target,
    basePath: [`${$id}#`],
  });

  const jsonSchema: JsonSchema = {
    $id,
    ...zodJsonSchema,
  };

  const $ref: $ref<M> = (key) => {
    const $ref = `${$id}#/properties/${
      typeof key === `string` ? key : key.key
    }`;
    return typeof key === `string`
      ? {
          $ref,
        }
      : {
          $ref,
          description: key.description,
        };
  };

  return {
    schemas: [jsonSchema],
    $ref,
  };
};
