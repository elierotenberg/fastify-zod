import { z } from "zod";

import { buildJsonSchema } from "../buildJsonSchema";

import { helpers } from "./utils";

describe(`buildJsonSchema`, () => {
  for (const target of [`jsonSchema7`, `openApi3`, undefined] as const) {
    describe(`target: ${target}`, () => {
      const { $schema, constOrEnum, stringEnum, options } = helpers(target);
      test(`primitives`, () => {
        expect(buildJsonSchema(z.string(), `ZString`, options)).toEqual({
          $id: `ZString`,
          ...$schema,
          type: `string`,
        });

        expect(
          buildJsonSchema(z.string().min(42), `ZStringMin`, options),
        ).toEqual({
          $id: `ZStringMin`,
          ...$schema,
          type: `string`,
          minLength: 42,
        });

        expect(buildJsonSchema(z.date(), `ZDate`, options)).toEqual({
          $id: `ZDate`,
          ...$schema,
          type: `string`,
          format: `date-time`,
        });

        expect(buildJsonSchema(z.literal(42), `ZLiteral`, options)).toEqual({
          $id: `ZLiteral`,
          ...$schema,
          type: `number`,
          ...constOrEnum(42),
        });

        expect(buildJsonSchema(z.string().uuid(), `ZUuid`, options)).toEqual({
          $id: `ZUuid`,
          ...$schema,
          type: `string`,
          format: `uuid`,
        });
      });

      test(`enums`, () => {
        expect(
          buildJsonSchema(z.enum([`one`, `two`, `three`]), `ZEnum`, options),
        ).toEqual({
          $id: `ZEnum`,
          ...$schema,
          type: `string`,
          enum: [`one`, `two`, `three`],
        });

        enum NativeEnum {
          One = `one`,
          Two = `two`,
          Three = `three`,
        }

        expect(
          buildJsonSchema(z.nativeEnum(NativeEnum), `ZNativeEnum`, options),
        ).toEqual({
          $id: `ZNativeEnum`,
          ...$schema,
          type: `string`,
          enum: [`one`, `two`, `three`],
        });
      });

      test(`objects`, () => {
        expect(
          buildJsonSchema(
            z.object({
              name: z.string(),
              age: z.number(),
              uuid: z.string().uuid().optional(),
            }),
            `ZObject`,
            options,
          ),
        ).toEqual({
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

        expect(
          buildJsonSchema(
            z
              .object({
                name: z.string(),
                age: z.number(),
                uuid: z.string().uuid().optional(),
              })
              .partial(),
            `ZObjectPartial`,
            options,
          ),
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
        expect(buildJsonSchema(z.array(z.string()), `ZArray`, options)).toEqual(
          {
            $id: `ZArray`,
            ...$schema,
            type: `array`,
            items: { type: `string` },
          },
        );

        expect(
          buildJsonSchema(
            z.array(z.string()).min(5).max(12),
            `ZArrayMinMax`,
            options,
          ),
        ).toEqual({
          $id: `ZArrayMinMax`,
          ...$schema,
          type: `array`,
          items: { type: `string` },
          minItems: 5,
          maxItems: 12,
        });
      });

      test(`tuples`, () => {
        expect(
          buildJsonSchema(
            z.tuple([z.string(), z.number(), z.literal(42)]),
            `ZTuple`,
            options,
          ),
        ).toEqual({
          $id: `ZTuple`,
          ...$schema,
          type: `array`,
          minItems: 3,
          maxItems: 3,
          items: [
            { type: `string` },
            { type: `number` },
            { type: `number`, ...constOrEnum(42) },
          ],
        });
      });

      test(`unions`, () => {
        expect(
          buildJsonSchema(
            z.union([z.string(), z.number(), z.literal(42)]),
            `ZUnion`,
            options,
          ),
        ).toEqual({
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
        expect(
          buildJsonSchema(z.record(z.number()), `ZRecord`, options),
        ).toEqual({
          $id: `ZRecord`,
          ...$schema,
          type: `object`,
          additionalProperties: { type: `number` },
        });
      });

      test(`intersections`, () => {
        expect(
          buildJsonSchema(
            z.intersection(z.number().min(2), z.number().max(12)),
            `ZIntersection`,
            options,
          ),
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

        expect(buildJsonSchema(TodoList, `TodoList`, options)).toEqual({
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
    });
  }
});
