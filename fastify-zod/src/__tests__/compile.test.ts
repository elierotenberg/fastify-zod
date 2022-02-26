import { inspect } from "util";

import { compile } from "..";

import { createTestServer, models, TodoItem } from "./fixtures";

describe(`compile`, () => {
  test(`fastify`, async () => {
    const { schema, $ref, $defs } = compile(`models`, models, {
      target: `jsonSchema7`,
    });
    console.debug(inspect(schema, { depth: null }));
    const server = createTestServer((app) => {
      app.addSchema(schema);
    }, $ref);

    expect($ref(`TodoItem`)).toEqual({
      $ref: `models#/properties/TodoItem`,
    });
    expect($defs.TodoItem).toEqual(TodoItem);

    await expect(
      server.inject({ method: `get`, url: `/item` }).then((res) => res.json()),
    ).resolves.toEqual([]);

    await expect(
      server
        .inject({ method: `post`, url: `/item`, payload: {} })
        .then((res) => res.json()),
    ).resolves.toEqual({
      error: `Bad Request`,
      message: `body should have required property 'id'`,
      statusCode: 400,
    });

    await expect(
      server
        .inject({
          method: `post`,
          url: `/item`,
          payload: {
            id: `not a uuid`,
          },
        })
        .then((res) => res.json()),
    ).resolves.toEqual({
      error: `Bad Request`,
      message: `body.id should match format "uuid"`,
      statusCode: 400,
    });
  });
});
