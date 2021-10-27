import { createTestServer } from "./fixtures";

test(`fastify`, async () => {
  const server = createTestServer();
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

  await expect(
    server
      .inject({
        method: `post`,
        url: `/item`,
        payload: {
          id: `e5715cb4-8932-4ed0-8801-38c2ec141c7e`,
          label: `a label`,
          dueDate: new Date(0),
          state: `todo`,
        },
      })
      .then((res) => res.json()),
  ).resolves.toEqual([
    {
      dueDate: `1970-01-01T00:00:00.000Z`,
      id: `e5715cb4-8932-4ed0-8801-38c2ec141c7e`,
      label: `a label`,
      state: `todo`,
    },
  ]);

  await expect(
    server
      .inject({
        method: `get`,
        url: `/item`,
      })
      .then((res) => res.json()),
  ).resolves.toEqual([
    {
      dueDate: `1970-01-01T00:00:00.000Z`,
      id: `e5715cb4-8932-4ed0-8801-38c2ec141c7e`,
      label: `a label`,
      state: `todo`,
    },
  ]);

  await expect(
    server
      .inject({
        method: `put`,
        url: `/item/e5715cb4-8932-4ed0-8801-38c2ec141c7e`,
        payload: {
          id: `c54eb655-ca39-425c-80d6-7e994a5b9fe2`,
          label: `new label`,
          state: `in progress`,
        },
      })
      .then((res) => res.json()),
  ).resolves.toEqual({
    id: `c54eb655-ca39-425c-80d6-7e994a5b9fe2`,
    label: `new label`,
    state: `in progress`,
  });

  await expect(
    server
      .inject({
        method: `get`,
        url: `/openapi/json`,
      })
      .then((res) => res.json()),
  ).resolves.toEqual({
    openapi: `3.0.3`,
    info: {
      title: `Zod Fastify Test Server`,
      description: `API for Zod Fastify Test Server`,
      version: `0.0.0`,
    },
    components: {
      schemas: {
        TodoItems: {
          type: `array`,
          items: {
            type: `object`,
            properties: {
              id: {
                type: `string`,
                format: `uuid`,
              },
              label: {
                type: `string`,
              },
              dueDate: {
                type: `string`,
                format: `date-time`,
              },
              state: {
                type: `string`,
                enum: [`todo`, `in progress`, `done`],
              },
            },
            required: [`id`, `label`, `state`],
            additionalProperties: false,
          },
        },
        TodoItem: {
          type: `object`,
          properties: {
            id: {
              type: `string`,
              format: `uuid`,
            },
            label: {
              type: `string`,
            },
            dueDate: {
              type: `string`,
              format: `date-time`,
            },
            state: {
              type: `string`,
              enum: [`todo`, `in progress`, `done`],
            },
          },
          required: [`id`, `label`, `state`],
          additionalProperties: false,
        },
        TodoItemId: {
          type: `object`,
          properties: {
            id: {
              type: `string`,
              format: `uuid`,
            },
          },
          required: [`id`],
          additionalProperties: false,
        },
      },
    },
    paths: {
      "/item": {
        get: {
          operationId: `getTodoItems`,
          responses: {
            "200": {
              description: `Default Response`,
              content: {
                "application/json": {
                  schema: {
                    $ref: `#/components/schemas/TodoItems`,
                  },
                },
              },
            },
          },
        },
        post: {
          operationId: `postTodoItem`,
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  $ref: `#/components/schemas/TodoItem`,
                },
              },
            },
          },
          responses: {
            "200": {
              description: `Default Response`,
              content: {
                "application/json": {
                  schema: {
                    $ref: `#/components/schemas/TodoItems`,
                  },
                },
              },
            },
          },
        },
      },
      "/item/{id}": {
        put: {
          operationId: `putTodoItem`,
          requestBody: {
            content: {
              "application/json": {
                schema: {
                  $ref: `#/components/schemas/TodoItem`,
                },
              },
            },
          },
          parameters: [
            {
              in: `path`,
              name: `id`,
              required: true,
              schema: {
                type: `string`,
                format: `uuid`,
              },
            },
          ],
          responses: {
            "200": {
              description: `Default Response`,
              content: {
                "application/json": {
                  schema: {
                    $ref: `#/components/schemas/TodoItem`,
                  },
                },
              },
            },
          },
        },
      },
    },
  });
});

export {};
