import { Options } from "..";

type Helpers = {
  $schema: Record<string, unknown>;
  constOrEnum: (value: unknown) => Record<string, unknown>;
  stringEnum: (values: unknown[]) => Record<string, unknown>;
  options: Options;
};

export const helpers = (
  target: `jsonSchema7` | `openApi3` | undefined,
): Helpers => {
  if (target === `openApi3`) {
    return {
      $schema: {},
      constOrEnum: (value) => ({
        enum: [value],
      }),
      stringEnum: (values) => ({
        anyOf: values.map((value) => ({
          type: `string`,
          enum: [value],
        })),
      }),
      options: { target },
    };
  }
  if (target === `jsonSchema7`) {
    return {
      $schema: { $schema: `http://json-schema.org/draft-07/schema#` },
      constOrEnum: (value) => ({ const: value }),
      stringEnum: (values) => ({
        type: `string`,
        enum: values,
      }),
      options: { target },
    };
  }
  return helpers(`jsonSchema7`);
};
