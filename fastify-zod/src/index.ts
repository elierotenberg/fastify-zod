import { z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";
import type { SwaggerOptions } from "fastify-swagger";

export type JsonSchema<$id extends string> = {
  $id: $id;
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
): JsonSchema<$id> => ({
  $id,
  ...zodToJsonSchema(ZodSchema, { target: "openApi3" }),
});

export const buildJsonSchemas = <$id extends string>(
  zodSchemas: Record<$id, z.ZodType<unknown>>,
): JsonSchemas<$id> => ({
  schemas: Object.entries(zodSchemas).reduce<JsonSchemas<$id>[`schemas`]>(
    (schemas, [$id, ZodSchema]) => [
      buildJsonSchema(ZodSchema as z.ZodType<unknown>, $id as $id),
      ...schemas,
    ],
    [],
  ),
  $ref: ($id) => ({
    $ref: `${$id}#`,
  }),
});

export const withRefResolver = (options: SwaggerOptions): SwaggerOptions =>
  ({
    ...options,
    refResolver: {
      buildLocalReference: (json: { $id: string }) => json.$id,
    },
  } as unknown as SwaggerOptions);
