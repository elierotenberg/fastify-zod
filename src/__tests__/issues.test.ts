import fastify from "fastify";
import { z } from "zod";

import { buildJsonSchemas, register } from "..";

test(`fix #8`, () => {
  const productInput = {
    title: z.string(),
    price: z.number(),
    content: z.string().optional(),
  };

  const productGenerated = {
    id: z.number(),
    createdAt: z.string(),
    updatedAt: z.string(),
  };

  const createProductSchema = z.object({
    ...productInput,
  });

  const productResponseSchema = z.object({
    ...productInput,
    ...productGenerated,
  });

  const productsResponseSchema = z.array(productResponseSchema);

  buildJsonSchemas({
    createProductSchema,
    productResponseSchema,
    productsResponseSchema,
  });

  const userCoreSchema = {
    email: z
      .string({
        required_error: `Email is required`,
        invalid_type_error: `Email must be a string`,
      })
      .email(),
    name: z.string(),
  };

  const createUserSchema = z.object({
    ...userCoreSchema,
    password: z.string({
      required_error: `Password is required`,
      invalid_type_error: `Password must be a string`,
    }),
  });

  const createUserResponseSchema = z.object({
    ...userCoreSchema,
    id: z.number(),
  });

  const loginSchema = z.object({
    email: z
      .string({
        required_error: `Email is required`,
        invalid_type_error: `Email must be a string`,
      })
      .email(),
    password: z.string(),
  });

  const loginResponseSchema = z.object({
    accessToken: z.string(),
  });

  buildJsonSchemas({
    createUserSchema,
    createUserResponseSchema,
    loginSchema,
    loginResponseSchema,
  });
});

test(`fix #14, #17`, async () => {
  const Name = z.object({
    kind: z.literal(`name`),
    name: z.string(),
    lastName: z.string(),
  });

  const Address = z.object({
    kind: z.literal(`address`),
    street: z.string(),
    postcode: z.string(),
  });

  const UserDetails = z.union([Name, Address]);

  const Unknown = z.unknown();

  const jsonSchemas = buildJsonSchemas({ UserDetails, Unknown }, {});

  const f = await register(fastify(), {
    jsonSchemas,
  });

  f.zod.get(
    `/`,
    {
      operationId: `getUserDetails`,
      querystring: `UserDetails`,
      reply: `UserDetails`,
    },
    async ({ query }) => query,
  );

  const name = await f
    .inject({ method: `get`, url: `/`, query: { kind: `name` } })
    .then((res) => res.json());

  expect(name).toEqual({
    code: `FST_ERR_VALIDATION`,
    error: `Bad Request`,
    message: `querystring must have required property 'name', querystring must have required property 'street', querystring must match a schema in anyOf`,
    statusCode: 400,
  });

  const address = await f
    .inject({ method: `get`, url: `/`, query: { kind: `address` } })
    .then((res) => res.json());

  expect(address).toEqual({
    code: `FST_ERR_VALIDATION`,
    error: `Bad Request`,
    message: `querystring must have required property 'name', querystring must have required property 'street', querystring must match a schema in anyOf`,
    statusCode: 400,
  });
});
