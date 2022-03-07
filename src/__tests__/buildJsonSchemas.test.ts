import { z } from "zod";

import { buildJsonSchemas } from "..";
type Helpers = {
  $schema: Record<string, unknown>;
  constOrEnum: (value: unknown) => Record<string, unknown>;
  stringEnum: (values: unknown[]) => Record<string, unknown>;
  target?: `jsonSchema7` | `openApi3`;
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
      target,
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
      target,
    };
  }
  return helpers(`jsonSchema7`);
};

describe(`buildJsonSchemas`, () => {
  for (const target of [`jsonSchema7`, `openApi3`, undefined] as const) {
    const { $schema, constOrEnum, stringEnum } = helpers(target);
    describe(`target: ${target ?? `none`}`, () => {
      test(`primitives`, () => {
        const models = {
          ZString: z.string(),
          ZStringMin: z.string().min(42),
          ZDate: z.date(),
          ZLiteral: z.literal(42),
          ZUuid: z.string().uuid(),
        };

        const { schemas, $ref } = buildJsonSchemas(models, {
          target,
        });

        expect($ref(`ZString`)).toEqual({ $ref: `Schema#/properties/ZString` });

        expect($ref(`ZStringMin`)).toEqual({
          $ref: `Schema#/properties/ZStringMin`,
        });

        expect($ref(`ZDate`)).toEqual({ $ref: `Schema#/properties/ZDate` });

        expect($ref(`ZLiteral`)).toEqual({
          $ref: `Schema#/properties/ZLiteral`,
        });

        expect($ref(`ZUuid`)).toEqual({ $ref: `Schema#/properties/ZUuid` });

        expect(schemas).toEqual([
          {
            $id: `Schema`,
            ...$schema,
            type: `object`,
            properties: {
              ZString: {
                type: `string`,
              },
              ZStringMin: {
                type: `string`,
                minLength: 42,
              },
              ZDate: {
                type: `string`,
                format: `date-time`,
              },
              ZLiteral: {
                type: `number`,
                ...constOrEnum(42),
              },
              ZUuid: {
                type: `string`,
                format: `uuid`,
              },
            },
            required: [`ZString`, `ZStringMin`, `ZDate`, `ZLiteral`, `ZUuid`],
            additionalProperties: false,
          },
        ]);
      });

      test(`enums`, () => {
        enum NativeEnum {
          One = `one`,
          Two = `two`,
          Three = `three`,
        }

        const schema = {
          ZEnum: z.enum([`one`, `two`, `three`]),
          ZNativeEnum: z.nativeEnum(NativeEnum),
        };

        const { schemas, $ref } = buildJsonSchemas(schema, {
          target,
        });

        expect($ref(`ZEnum`)).toEqual({ $ref: `Schema#/properties/ZEnum` });

        expect($ref(`ZNativeEnum`)).toEqual({
          $ref: `Schema#/properties/ZNativeEnum`,
        });

        expect(schemas).toEqual([
          {
            $id: `Schema`,
            ...$schema,
            type: `object`,
            properties: {
              ZEnum: {
                type: `string`,
                enum: [`one`, `two`, `three`],
              },
              ZNativeEnum: {
                type: `string`,
                enum: [`one`, `two`, `three`],
              },
            },
            required: [`ZEnum`, `ZNativeEnum`],
            additionalProperties: false,
          },
        ]);
      });

      test(`objects`, () => {
        const models = {
          ZObject: z.object({
            name: z.string(),
            age: z.number(),
            uuid: z.string().uuid().optional(),
          }),
          ZObjectPartial: z
            .object({
              name: z.string(),
              age: z.number(),
              uuid: z.string().uuid().optional(),
            })
            .partial(),
        };

        const { schemas, $ref } = buildJsonSchemas(models, { target });

        expect($ref(`ZObject`)).toEqual({ $ref: `Schema#/properties/ZObject` });

        expect($ref(`ZObjectPartial`)).toEqual({
          $ref: `Schema#/properties/ZObjectPartial`,
        });

        expect(schemas).toEqual([
          {
            $id: `Schema`,
            ...$schema,
            type: `object`,
            properties: {
              ZObject: {
                type: `object`,
                properties: {
                  name: {
                    type: `string`,
                  },
                  age: {
                    type: `number`,
                  },
                  uuid: {
                    type: `string`,
                    format: `uuid`,
                  },
                },
                required: [`name`, `age`],
                additionalProperties: false,
              },
              ZObjectPartial: {
                type: `object`,
                properties: {
                  name: {
                    type: `string`,
                  },
                  age: {
                    type: `number`,
                  },
                  uuid: {
                    type: `string`,
                    format: `uuid`,
                  },
                },
                additionalProperties: false,
              },
            },
            required: [`ZObject`, `ZObjectPartial`],
            additionalProperties: false,
          },
        ]);
      });

      test(`arrays`, () => {
        const models = {
          ZArray: z.array(z.string()),
          ZArrayMinMax: z.array(z.string()).min(5).max(12),
        };

        const { schemas, $ref } = buildJsonSchemas(models, { target });

        expect($ref(`ZArray`)).toEqual({ $ref: `Schema#/properties/ZArray` });

        expect($ref(`ZArrayMinMax`)).toEqual({
          $ref: `Schema#/properties/ZArrayMinMax`,
        });

        expect(schemas).toEqual([
          {
            $id: `Schema`,
            ...$schema,
            type: `object`,
            properties: {
              ZArray: {
                type: `array`,
                items: {
                  type: `string`,
                },
              },
              ZArrayMinMax: {
                type: `array`,
                items: {
                  type: `string`,
                },
                minItems: 5,
                maxItems: 12,
              },
            },
            required: [`ZArray`, `ZArrayMinMax`],
            additionalProperties: false,
          },
        ]);
      });

      test(`tuples`, () => {
        const models = {
          ZTuple: z.tuple([z.string(), z.number(), z.literal(42)]),
        };

        const { schemas, $ref } = buildJsonSchemas(models, { target });

        expect($ref(`ZTuple`)).toEqual({ $ref: `Schema#/properties/ZTuple` });

        expect(schemas).toEqual([
          {
            $id: `Schema`,
            ...$schema,
            type: `object`,
            properties: {
              ZTuple: {
                type: `array`,
                minItems: 3,
                maxItems: 3,
                items: [
                  {
                    type: `string`,
                  },
                  {
                    type: `number`,
                  },
                  {
                    type: `number`,
                    ...constOrEnum(42),
                  },
                ],
              },
            },
            required: [`ZTuple`],
            additionalProperties: false,
          },
        ]);
      });

      test(`unions`, () => {
        const models = {
          ZUnion: z.union([z.string(), z.number(), z.literal(42)]),
        };

        const { schemas, $ref } = buildJsonSchemas(models, { target });

        expect($ref(`ZUnion`)).toEqual({ $ref: `Schema#/properties/ZUnion` });

        expect(schemas).toEqual([
          {
            $id: `Schema`,
            ...$schema,
            type: `object`,
            properties: {
              ZUnion: {
                anyOf: [
                  {
                    type: `string`,
                  },
                  {
                    type: `number`,
                  },
                  {
                    type: `number`,
                    ...constOrEnum(42),
                  },
                ],
              },
            },
            required: [`ZUnion`],
            additionalProperties: false,
          },
        ]);
      });

      test(`records`, () => {
        const models = {
          ZRecord: z.record(z.number()),
        };

        const { schemas, $ref } = buildJsonSchemas(models, { target });

        expect($ref(`ZRecord`)).toEqual({ $ref: `Schema#/properties/ZRecord` });

        expect(schemas).toEqual([
          {
            $id: `Schema`,
            ...$schema,
            type: `object`,
            properties: {
              ZRecord: {
                type: `object`,
                additionalProperties: { type: `number` },
              },
            },
            required: [`ZRecord`],
            additionalProperties: false,
          },
        ]);
      });

      test(`intersections`, () => {
        const models = {
          ZIntersection: z.intersection(z.number().min(2), z.number().max(12)),
        };

        const { schemas, $ref } = buildJsonSchemas(models, { target });

        expect($ref(`ZIntersection`)).toEqual({
          $ref: `Schema#/properties/ZIntersection`,
        });

        expect(schemas).toEqual([
          {
            $id: `Schema`,
            ...$schema,
            type: `object`,
            properties: {
              ZIntersection: {
                allOf: [
                  { type: `number`, minimum: 2 },
                  { type: `number`, maximum: 12 },
                ],
              },
            },
            required: [`ZIntersection`],
            additionalProperties: false,
          },
        ]);
      });

      test(`composite`, () => {
        const TodoItem = z.object({
          itemId: z.number(),
          label: z.string(),
          state: z.union([
            z.literal(`todo`),
            z.literal(`in progress`),
            z.literal(`done`),
          ]),
          dueDate: z.string().optional(),
        });

        const TodoList = z.array(TodoItem);

        const models = {
          TodoList,
        };

        const { schemas, $ref } = buildJsonSchemas(models, { target });

        expect($ref(`TodoList`)).toEqual({
          $ref: `Schema#/properties/TodoList`,
        });

        expect(schemas).toEqual([
          {
            $id: `Schema`,
            ...$schema,
            type: `object`,
            properties: {
              TodoList: {
                type: `array`,
                items: {
                  type: `object`,
                  properties: {
                    itemId: { type: `number` },
                    label: { type: `string` },
                    state: stringEnum([`todo`, `in progress`, `done`]),
                    dueDate: { type: `string` },
                  },
                  required: [`itemId`, `label`, `state`],
                  additionalProperties: false,
                },
              },
            },
            required: [`TodoList`],
            additionalProperties: false,
          },
        ]);
      });

      test(`references`, () => {
        const TodoItemState = z.enum([`todo`, `in progress`, `done`]);

        const TodoItem = z.object({
          id: z.number(),
          label: z.string(),
          state: TodoItemState,
        });

        const TodoList = z.array(TodoItem);

        const schema = {
          TodoItemState,
          TodoItem,
          TodoList,
        };

        const { schemas } = buildJsonSchemas(schema, { target });

        expect(schemas).toEqual([
          {
            $id: `Schema`,
            ...$schema,
            type: `object`,
            properties: {
              TodoItemState: {
                type: `string`,
                enum: [`todo`, `in progress`, `done`],
              },
              TodoItem: {
                type: `object`,
                properties: {
                  id: { type: `number` },
                  label: { type: `string` },
                  state: { $ref: `Schema#/properties/TodoItemState` },
                },
                required: [`id`, `label`, `state`],
                additionalProperties: false,
              },
              TodoList: {
                type: `array`,
                items: { $ref: `Schema#/properties/TodoItem` },
              },
            },
            required: [`TodoItemState`, `TodoItem`, `TodoList`],
            additionalProperties: false,
          },
        ]);
      });
    });
  }
});
