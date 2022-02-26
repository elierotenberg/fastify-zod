import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

export type JsonSchema<$id extends string> = {
  $id: $id;
  $schema?: string;
};

type Target = `openApi3` | `jsonSchema7`;

export type BuildJsonSchemaOptions = {
  readonly target?: Target;
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

export const buildJsonSchemas = <$id extends string>(
  zodSchemas: Record<$id, z.ZodType<unknown>>,
  { target = `jsonSchema7` }: BuildJsonSchemaOptions = {},
): JsonSchemas<$id> => {
  const schemas: JsonSchemas<$id> = {
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

  return schemas;
};
