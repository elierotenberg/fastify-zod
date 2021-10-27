import { z } from "zod";

import { buildJsonSchema } from "..";

describe(`buildJsonSchema`, () => {
  test(`primitives`, () => {
    expect(buildJsonSchema(z.string(), `ZString`)).toEqual({
      $id: `ZString`,
      $schema: `http://json-schema.org/draft-07/schema#`,
      type: `string`,
    });

    expect(buildJsonSchema(z.string().min(42), `ZStringMin`)).toEqual({
      $id: `ZStringMin`,
      $schema: `http://json-schema.org/draft-07/schema#`,
      type: `string`,
      minLength: 42,
    });

    expect(buildJsonSchema(z.date(), `ZDate`)).toEqual({
      $id: `ZDate`,
      $schema: `http://json-schema.org/draft-07/schema#`,
      type: `string`,
      format: `date-time`,
    });

    expect(buildJsonSchema(z.literal(42), `ZLiteral`)).toEqual({
      $id: `ZLiteral`,
      $schema: `http://json-schema.org/draft-07/schema#`,
      type: `number`,
      const: 42,
    });

    expect(buildJsonSchema(z.string().uuid(), `ZUuid`)).toEqual({
      $id: `ZUuid`,
      $schema: `http://json-schema.org/draft-07/schema#`,
      type: `string`,
      format: `uuid`,
    });
  });

  test(`enums`, () => {
    expect(buildJsonSchema(z.enum([`one`, `two`, `three`]), `ZEnum`)).toEqual({
      $id: `ZEnum`,
      $schema: `http://json-schema.org/draft-07/schema#`,
      type: `string`,
      enum: [`one`, `two`, `three`],
    });

    enum NativeEnum {
      One = `one`,
      Two = `two`,
      Three = `three`,
    }

    expect(buildJsonSchema(z.nativeEnum(NativeEnum), `ZNativeEnum`)).toEqual({
      $id: `ZNativeEnum`,
      $schema: `http://json-schema.org/draft-07/schema#`,
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
      ),
    ).toEqual({
      $id: `ZObject`,
      $schema: `http://json-schema.org/draft-07/schema#`,
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
      ),
    ).toEqual({
      $id: `ZObjectPartial`,
      $schema: `http://json-schema.org/draft-07/schema#`,
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
    expect(buildJsonSchema(z.array(z.string()), `ZArray`)).toEqual({
      $id: `ZArray`,
      $schema: `http://json-schema.org/draft-07/schema#`,
      type: `array`,
      items: { type: `string` },
    });

    expect(
      buildJsonSchema(z.array(z.string()).min(5).max(12), `ZArrayMinMax`),
    ).toEqual({
      $id: `ZArrayMinMax`,
      $schema: `http://json-schema.org/draft-07/schema#`,
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
      ),
    ).toEqual({
      $id: `ZTuple`,
      $schema: `http://json-schema.org/draft-07/schema#`,
      type: `array`,
      minItems: 3,
      maxItems: 3,
      items: [
        { type: `string` },
        { type: `number` },
        { type: `number`, const: 42 },
      ],
    });
  });

  test(`unions`, () => {
    expect(
      buildJsonSchema(
        z.union([z.string(), z.number(), z.literal(42)]),
        `ZUnion`,
      ),
    ).toEqual({
      $id: `ZUnion`,
      $schema: `http://json-schema.org/draft-07/schema#`,
      anyOf: [
        { type: `string` },
        { type: `number` },
        { type: `number`, const: 42 },
      ],
    });
  });

  test(`records`, () => {
    expect(buildJsonSchema(z.record(z.number()), `ZRecord`)).toEqual({
      $id: `ZRecord`,
      $schema: `http://json-schema.org/draft-07/schema#`,
      type: `object`,
      additionalProperties: { type: `number` },
    });
  });

  test(`intersections`, () => {
    expect(
      buildJsonSchema(
        z.intersection(z.number().min(2), z.number().max(12)),
        `ZIntersection`,
      ),
    ).toEqual({
      $id: `ZIntersection`,
      $schema: `http://json-schema.org/draft-07/schema#`,
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

    expect(buildJsonSchema(TodoList, `TodoList`)).toEqual({
      $id: `TodoList`,
      $schema: `http://json-schema.org/draft-07/schema#`,
      type: `array`,
      items: {
        type: `object`,
        properties: {
          itemId: { type: `number` },
          label: { type: `string` },
          state: { type: `string`, enum: [`todo`, `in progress`, `done`] },
          dueDate: { type: `string` },
        },
        required: [`itemId`, `label`, `state`],
        additionalProperties: false,
      },
    });
  });
});

export {};
