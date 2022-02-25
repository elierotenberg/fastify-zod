import fastify, { FastifyInstance } from "fastify";
import { z } from "zod";
import swagger from "fastify-swagger";
import { BadRequest, NotFound } from "http-errors";

import { buildJsonSchemas, withRefResolver } from "..";

export const TodoItemId = z.object({
  id: z.string().uuid(),
});
export type TodoItemId = z.infer<typeof TodoItemId>;

export const TodoItem = TodoItemId.extend({
  label: z.string(),
  dueDate: z.date().optional(),
  state: z.union([
    z.literal(`todo`),
    z.literal(`in progress`),
    z.literal(`done`),
  ]),
});

export type TodoItem = z.infer<typeof TodoItem>;

export const TodoItems = z.array(TodoItem);
export type TodoItems = z.infer<typeof TodoItems>;

const { schemas, $ref } = buildJsonSchemas({
  TodoItemId,
  TodoItem,
  TodoItems,
});

export const createTestServer = (): FastifyInstance => {
  let state: TodoItem[] = [];
  const app: FastifyInstance = fastify();

  for (const schema of schemas) {
    app.addSchema(schema);
  }

  app.register(
    swagger,
    withRefResolver({
      routePrefix: `/openapi`,
      exposeRoute: true,
      staticCSP: true,
      openapi: {
        info: {
          title: `Zod Fastify Test Server`,
          description: `API for Zod Fastify Test Server`,
          version: `0.0.0`,
        },
      },
    }),
  );

  app.get<{
    Reply: TodoItems;
  }>(
    `/item`,
    {
      schema: {
        operationId: `getTodoItems`,
        response: {
          200: $ref(`TodoItems`),
        },
      },
    },
    async () => state,
  );

  app.post<{
    Body: TodoItem;
    Reply: TodoItems;
  }>(
    `/item`,
    {
      schema: {
        operationId: `postTodoItem`,
        body: $ref(`TodoItem`),
        response: {
          200: $ref(`TodoItems`),
        },
      },
    },
    async ({ body: nextItem }) => {
      if (state.some((prevItem) => prevItem.id === nextItem.id)) {
        throw new BadRequest(`item already exists`);
      }
      state = [...state, nextItem];
      return state;
    },
  );

  app.put<{
    Params: TodoItemId;
    Body: TodoItem;
    Reply: TodoItem;
  }>(
    `/item/:id`,
    {
      schema: {
        operationId: `putTodoItem`,
        body: $ref(`TodoItem`),
        params: $ref(`TodoItemId`),
        response: {
          200: $ref(`TodoItem`),
        },
      },
    },
    async ({ params: { id }, body: nextItem }) => {
      if (!state.some((prevItem) => prevItem.id === id)) {
        throw new NotFound(`no such item`);
      }
      state = state.map((prevItem) =>
        prevItem.id === id ? nextItem : prevItem,
      );
      return nextItem;
    },
  );

  return app;
};
