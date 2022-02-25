import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import type { SwaggerOptions } from "fastify-swagger";

export type JsonSchema<$id extends string> = {
  $id: $id;
  $schema?: string;
};

type Target = `openApi3` | `jsonSchema7`;

export type BuildJsonSchemaOptions = {
  readonly target?: Target;
};

export type BuildJsonSchemasOptions = BuildJsonSchemaOptions & {
  readonly mergeRefs?: boolean;
};

export type JsonSchemas<$id extends string> = {
  schemas: JsonSchema<$id>[];
  $ref: <$$id extends $id>(
    $id: $$id,
  ) => {
    $ref: `${$$id}#`;
  };
};

export const buildJsonSchema = <$id extends string>(
  ZodSchema: z.ZodType<unknown>,
  $id: $id,
  { target = `jsonSchema7` }: BuildJsonSchemaOptions = {},
): JsonSchema<$id> => ({
  $id,
  ...zodToJsonSchema(ZodSchema, { target }),
});

const traverse = (
  value: unknown,
  visit: (value: unknown) => unknown,
): unknown => {
  const next = visit(value);
  if (Array.isArray(next)) {
    return next.map((item) => traverse(item, visit));
  }
  if (typeof next === `object` && next !== null) {
    return Object.entries(next).reduce(
      (next, [key, value]) => ({
        ...next,
        [key]: traverse(value, visit),
      }),
      Object.create(null),
    );
  }
  return next;
};

export const buildJsonSchemas = <$id extends string>(
  zodSchemas: Record<$id, z.ZodType<unknown>>,
  { target = `jsonSchema7`, mergeRefs = false }: BuildJsonSchemasOptions = {},
): JsonSchemas<$id> => {
  let schemas: JsonSchemas<$id> = {
    schemas: Object.entries(zodSchemas).reduce<JsonSchemas<$id>[`schemas`]>(
      (schemas, [$id, ZodSchema]) => [
        buildJsonSchema(ZodSchema as z.ZodType<unknown>, $id as $id, {
          target,
        }),
        ...schemas,
      ],
      [],
    ),
    $ref: ($id) => ({
      $ref: `${$id}#`,
    }),
  };

  if (mergeRefs) {
    let dirty = true;
    while (dirty) {
      dirty = false;
      schemas = traverse(schemas, (value) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const { $id, $schema, ...schema } of schemas.schemas) {
          if (
            value !== schema &&
            JSON.stringify(value) === JSON.stringify(schema)
          ) {
            dirty = true;
            return {
              $ref: `${$id}#`,
            };
          }
        }
        return value;
      }) as JsonSchemas<$id>;
    }
  }
  return schemas;
};

export const withRefResolver = (options: SwaggerOptions): SwaggerOptions =>
  ({
    ...options,
    refResolver: {
      buildLocalReference: (json: { $id: string }) => json.$id,
    },
  } as unknown as SwaggerOptions);
