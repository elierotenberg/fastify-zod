import { z } from "zod";

import { buildJsonSchemas } from "..";

import { helpers } from "./utils";

describe(`buildJsonSchemas`, () => {
  for (const target of [`jsonSchema7`, `openApi3`, undefined] as const) {
    const { $schema, options } = helpers(target);
    describe(`target:`, () => {
      test(`simple`, () => {
        const Person = z.object({
          name: z.string(),
          age: z.number(),
        });

        const Place = z.object({
          name: z.string(),
          location: z.object({
            lat: z.string(),
            long: z.string(),
          }),
        });

        const jsonSchemas = buildJsonSchemas(
          {
            Person,
            Place,
          },
          options,
        );

        expect(jsonSchemas).toEqual({
          schemas: [
            {
              $id: `Place`,
              ...$schema,
              type: `object`,
              properties: {
                name: { type: `string` },
                location: {
                  type: `object`,
                  properties: {
                    lat: { type: `string` },
                    long: { type: `string` },
                  },
                  required: [`lat`, `long`],
                  additionalProperties: false,
                },
              },
              required: [`name`, `location`],
              additionalProperties: false,
            },
            {
              $id: `Person`,
              ...$schema,
              type: `object`,
              properties: { name: { type: `string` }, age: { type: `number` } },
              required: [`name`, `age`],
              additionalProperties: false,
            },
          ],
          $ref: expect.any(Function),
        });

        expect(jsonSchemas.$ref(`Person`)).toEqual({ $ref: `Person#` });
      });
    });

    test(`mergeRefs:`, () => {
      enum FooFizzEnum {
        Foo = `Bar`,
        Fizz = `Buzz`,
      }

      const FooFizz = z.nativeEnum(FooFizzEnum);

      const FooFizzItem = z.object({
        value: FooFizz,
      });

      const unmerged = buildJsonSchemas({ FooFizz, FooFizzItem });

      expect(unmerged.schemas).toEqual([
        {
          $id: `FooFizzItem`,
          $schema: `http://json-schema.org/draft-07/schema#`,
          type: `object`,
          properties: { value: { type: `string`, enum: [`Bar`, `Buzz`] } },
          required: [`value`],
          additionalProperties: false,
        },
        {
          $id: `FooFizz`,
          $schema: `http://json-schema.org/draft-07/schema#`,
          type: `string`,
          enum: [`Bar`, `Buzz`],
        },
      ]);

      const merged = buildJsonSchemas(
        { FooFizz, FooFizzItem },
        { mergeRefs: true },
      );

      expect(merged.schemas).toEqual([
        {
          $id: `FooFizzItem`,
          $schema: `http://json-schema.org/draft-07/schema#`,
          type: `object`,
          properties: { value: { $ref: `FooFizz#` } },
          required: [`value`],
          additionalProperties: false,
        },
        {
          $id: `FooFizz`,
          $schema: `http://json-schema.org/draft-07/schema#`,
          type: `string`,
          enum: [`Bar`, `Buzz`],
        },
      ]);
    });
  }
});

export {};
