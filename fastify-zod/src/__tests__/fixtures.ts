import fastify, { FastifyInstance } from "fastify";
import fastifySwagger from "fastify-swagger";
import { z } from "zod";
import { BadRequest, NotFound } from "http-errors";

import { withFastifySwaggerRefResolver } from "../fastify-zod";

export const TodoItemId = z.object({
  id: z.string().uuid(),
});
export type TodoItemId = z.infer<typeof TodoItemId>;

enum TodoStateEnum {
  Todo = `todo`,
  InProgress = `in progress`,
  Done = `done`,
}

export const TodoState = z.nativeEnum(TodoStateEnum);

export const TodoItem = TodoItemId.extend({
  label: z.string(),
  dueDate: z.date().optional(),
  state: TodoState,
});

export type TodoItem = z.infer<typeof TodoItem>;

export const TodoItems = z.array(TodoItem);
export type TodoItems = z.infer<typeof TodoItems>;

export const TodoItemsGroupedByStatus = z.object({
  todo: z.array(TodoItem),
  inProgress: z.array(TodoItem),
  done: z.array(TodoItem),
});

export type TodoItemsGroupedByStatus = z.infer<typeof TodoItemsGroupedByStatus>;

export const models = {
  TodoState,
  TodoItem,
  TodoItems,
  TodoItemId,
  TodoItemsGroupedByStatus,
} as const;

export const createTestServer = (
  addSchemas: (app: FastifyInstance) => void,
  $ref: (ref: keyof typeof models) => unknown,
): FastifyInstance => {
  let state: TodoItem[] = [];
  const app: FastifyInstance = fastify();

  addSchemas(app);

  app.register(
    fastifySwagger,
    withFastifySwaggerRefResolver({
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

  app.get<{
    Reply: TodoItemsGroupedByStatus;
  }>(
    `/item/grouped-by-status`,
    {
      schema: {
        operationId: `getTodoItemsGroupedByStatus`,
        response: {
          200: $ref(`TodoItemsGroupedByStatus`),
        },
      },
    },
    async () => ({
      done: state.filter((item) => item.state === `done`),
      inProgress: state.filter((item) => item.state === `in progress`),
      todo: state.filter((item) => item.state === `todo`),
    }),
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
