import { ZodType, z } from "zod";
import zodToJsonSchema from "zod-to-json-schema";

export type Definitions<Key extends string> = {
  readonly [K in Key]: ZodType<unknown>;
};

type Ref<Id extends string, Key extends string> = {
  readonly $ref: `${Id}#/properties/${Key}`;
};

type $ref<Id extends string, Key extends string> = <K extends Key>(
  key: K,
) => Ref<Id, K>;

type CompileOptions = {
  readonly target?: `jsonSchema7` | `openApi3`;
};

export type Schema<
  Id extends string,
  Key extends string,
  $defs extends Definitions<Key>,
> = {
  readonly $ref: $ref<Id, Key & keyof $defs>;
  readonly $defs: $defs;
  readonly schema: unknown;
};

export const compile = <
  Id extends string,
  Key extends string,
  $defs extends Definitions<Key>,
>(
  $id: Id,
  $defs: $defs,
  { target = `jsonSchema7` }: CompileOptions = {},
): Schema<Id, Key, $defs> => {
  const zodSchema = z.object(
    Object.entries($defs).reduce(
      (obj, [key, $def]) => ({
        ...obj,
        [key]: $def,
      }),
      {},
    ),
  );
  const jsonSchema = zodToJsonSchema(zodSchema, {
    target,
  });
  return {
    $ref: (key) => ({
      $ref: `${$id}#/properties/${key}`,
    }),
    $defs,
    schema: {
      $id,
      ...jsonSchema,
    },
  };
};
