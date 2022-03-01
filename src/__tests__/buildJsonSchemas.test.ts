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
        const schema = {
          ZString: z.string(),
          ZStringMin: z.string().min(42),
          ZDate: z.date(),
          ZLiteral: z.literal(42),
          ZUuid: z.string().uuid(),
        };

        const { schemas, $ref } = buildJsonSchemas(schema, {
          target,
        });

        expect($ref(`ZString`)).toEqual({ $ref: `ZString#` });
        expect(schemas.find((schema) => schema.$id === `ZString`)).toEqual({
          $id: `ZString`,
          ...$schema,
          type: `string`,
        });

        expect($ref(`ZStringMin`)).toEqual({ $ref: `ZStringMin#` });
        expect(schemas.find((schema) => schema.$id === `ZStringMin`)).toEqual({
          $id: `ZStringMin`,
          ...$schema,
          type: `string`,
          minLength: 42,
        });

        expect($ref(`ZDate`)).toEqual({ $ref: `ZDate#` });
        expect(schemas.find((schema) => schema.$id === `ZDate`)).toEqual({
          $id: `ZDate`,
          ...$schema,
          type: `string`,
          format: `date-time`,
        });

        expect($ref(`ZLiteral`)).toEqual({ $ref: `ZLiteral#` });
        expect(schemas.find((schema) => schema.$id === `ZLiteral`)).toEqual({
          $id: `ZLiteral`,
          ...$schema,
          type: `number`,
          ...constOrEnum(42),
        });

        expect($ref(`ZUuid`)).toEqual({ $ref: `ZUuid#` });
        expect(schemas.find((schema) => schema.$id === `ZUuid`)).toEqual({
          $id: `ZUuid`,
          ...$schema,
          type: `string`,
          format: `uuid`,
        });
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

        expect($ref(`ZEnum`)).toEqual({ $ref: `ZEnum#` });
        expect(schemas.find((schema) => schema.$id === `ZEnum`)).toEqual({
          $id: `ZEnum`,
          ...$schema,
          type: `string`,
          enum: [`one`, `two`, `three`],
        });

        expect($ref(`ZNativeEnum`)).toEqual({ $ref: `ZNativeEnum#` });
        expect(schemas.find((schema) => schema.$id === `ZNativeEnum`)).toEqual({
          $id: `ZNativeEnum`,
          ...$schema,
          type: `string`,
          enum: [`one`, `two`, `three`],
        });
      });

      test(`objects`, () => {
        const schema = {
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

        const { schemas, $ref } = buildJsonSchemas(schema, { target });

        expect($ref(`ZObject`)).toEqual({ $ref: `ZObject#` });
        expect(schemas.find((schema) => schema.$id === `ZObject`)).toEqual({
          $id: `ZObject`,
          ...$schema,
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
        });

        expect($ref(`ZObjectPartial`)).toEqual({ $ref: `ZObjectPartial#` });
        expect(
          schemas.find((schema) => schema.$id === `ZObjectPartial`),
        ).toEqual({
          $id: `ZObjectPartial`,
          ...$schema,
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
        });
      });

      test(`arrays`, () => {
        const schema = {
          ZArray: z.array(z.string()),
          ZArrayMinMax: z.array(z.string()).min(5).max(12),
        };

        const { schemas, $ref } = buildJsonSchemas(schema, { target });

        expect($ref(`ZArray`)).toEqual({ $ref: `ZArray#` });
        expect(schemas.find((schema) => schema.$id === `ZArray`)).toEqual({
          $id: `ZArray`,
          ...$schema,
          type: `array`,
          items: {
            type: `string`,
          },
        });

        expect($ref(`ZArrayMinMax`)).toEqual({ $ref: `ZArrayMinMax#` });
        expect(schemas.find((schema) => schema.$id === `ZArrayMinMax`)).toEqual(
          {
            $id: `ZArrayMinMax`,
            ...$schema,
            type: `array`,
            items: {
              type: `string`,
            },
            minItems: 5,
            maxItems: 12,
          },
        );
      });

      test(`tuples`, () => {
        const schema = {
          ZTuple: z.tuple([z.string(), z.number(), z.literal(42)]),
        };

        const { schemas, $ref } = buildJsonSchemas(schema, { target });

        expect($ref(`ZTuple`)).toEqual({ $ref: `ZTuple#` });
        expect(schemas.find((schema) => schema.$id === `ZTuple`)).toEqual({
          $id: `ZTuple`,
          ...$schema,
          type: `array`,
          minItems: 3,
          maxItems: 3,
          items: [
            {
              type: `string`,
            },
            { type: `number` },
            { type: `number`, ...constOrEnum(42) },
          ],
        });
      });

      test(`unions`, () => {
        const schema = {
          ZUnion: z.union([z.string(), z.number(), z.literal(42)]),
        };

        const { schemas, $ref } = buildJsonSchemas(schema, { target });

        expect($ref(`ZUnion`)).toEqual({ $ref: `ZUnion#` });
        expect(schemas.find((schema) => schema.$id === `ZUnion`)).toEqual({
          $id: `ZUnion`,
          ...$schema,
          anyOf: [
            { type: `string` },
            { type: `number` },
            { type: `number`, ...constOrEnum(42) },
          ],
        });
      });

      test(`records`, () => {
        const schema = {
          ZRecord: z.record(z.number()),
        };

        const { schemas, $ref } = buildJsonSchemas(schema, { target });

        expect($ref(`ZRecord`)).toEqual({ $ref: `ZRecord#` });
        expect(schemas.find((schema) => schema.$id === `ZRecord`)).toEqual({
          $id: `ZRecord`,
          ...$schema,
          type: `object`,
          additionalProperties: {
            type: `number`,
          },
        });
      });

      test(`intersections`, () => {
        const schema = {
          ZIntersection: z.intersection(z.number().min(2), z.number().max(12)),
        };

        const { schemas, $ref } = buildJsonSchemas(schema, { target });

        expect($ref(`ZIntersection`)).toEqual({ $ref: `ZIntersection#` });
        expect(
          schemas.find((schema) => schema.$id === `ZIntersection`),
        ).toEqual({
          $id: `ZIntersection`,
          ...$schema,
          allOf: [
            { type: `number`, minimum: 2 },
            { type: `number`, maximum: 12 },
          ],
        });
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

        const schema = {
          TodoList,
        };

        const { schemas, $ref } = buildJsonSchemas(schema, { target });

        expect($ref(`TodoList`)).toEqual({ $ref: `TodoList#` });

        expect(schemas.find((schema) => schema.$id)).toEqual({
          $id: `TodoList`,
          ...$schema,
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
        });
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
            $id: `TodoItemState`,
            ...$schema,
            type: `string`,
            enum: [`todo`, `in progress`, `done`],
          },
          {
            $id: `TodoItem`,
            ...$schema,
            type: `object`,
            properties: {
              id: {
                type: `number`,
              },
              label: {
                type: `string`,
              },
              state: {
                $ref: `TodoItemState#`,
              },
            },
            required: [`id`, `label`, `state`],
            additionalProperties: false,
          },
          {
            $id: `TodoList`,
            ...$schema,
            type: `array`,
            items: {
              $ref: `TodoItem#`,
            },
          },
        ]);
      });
    });
  }
});
