import { z } from "zod";

import { buildJsonSchemas } from "../buildJsonSchema";

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
  }
});
