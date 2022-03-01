import { createTestServer } from "./fixtures";

describe(`createPlugin`, () => {
  for (const target of [`jsonSchema7`, `openApi3`, undefined] as const) {
    test(`target: ${target ?? `none`}`, async () => {
      const f = createTestServer({ target });

      const spec = await f
        .inject({
          method: `get`,
          url: `/openapi/json`,
        })
        .then((res) => res.json());

      expect(spec).toEqual({
        openapi: `3.0.3`,
        info: {
          title: `Zod Fastify Test Server`,
          description: `API for Zod Fastify Test Server`,
          version: `0.0.0`,
        },
        components: {
          schemas: {
            TodoItemId_properties_id: {
              type: `string`,
              format: `uuid`,
            },
            TodoItemId: {
              type: `object`,
              properties: {
                id: {
                  $ref: `#/components/schemas/TodoItemId_properties_id`,
                },
              },
              required: [`id`],
              additionalProperties: false,
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
            TodoItems: {
              type: `object`,
              properties: {
                todoItems: {
                  type: `array`,
                  items: {
                    $ref: `#/components/schemas/TodoItem`,
                  },
                },
              },
              required: [`todoItems`],
              additionalProperties: false,
            },
            TodoItemsGroupedByStatus: {
              type: `object`,
              properties: {
                todo: {
                  type: `array`,
                  items: {
                    $ref: `#/components/schemas/TodoItem`,
                  },
                },
                inProgress: {
                  type: `array`,
                  items: {
                    $ref: `#/components/schemas/TodoItem`,
                  },
                },
                done: {
                  type: `array`,
                  items: {
                    $ref: `#/components/schemas/TodoItem`,
                  },
                },
              },
              required: [`todo`, `inProgress`, `done`],
              additionalProperties: false,
            },
            FortyTwo: {
              type: `number`,
              enum: [42],
            },
          },
        },
        paths: {
          "/item": {
            get: {
              operationId: `getTodoItems`,
              responses: {
                "200": {
                  description: `The list of Todo Items`,
                  content: {
                    "application/json": {
                      schema: {
                        $ref: `#/components/schemas/TodoItems`,
                        description: `The list of Todo Items`,
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
          "/item/grouped-by-status": {
            get: {
              operationId: `getTodoItemsGroupedByStatus`,
              responses: {
                "200": {
                  description: `Default Response`,
                  content: {
                    "application/json": {
                      schema: {
                        $ref: `#/components/schemas/TodoItemsGroupedByStatus`,
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
                    $ref: `#/components/schemas/TodoItemId_properties_id`,
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
          "/42": {
            get: {
              operationId: `getFortyTwo`,
              responses: {
                "200": {
                  description: `Default Response`,
                  content: {
                    "application/json": {
                      schema: {
                        $ref: `#/components/schemas/FortyTwo`,
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
  }
});
