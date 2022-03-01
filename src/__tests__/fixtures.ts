import fastify, { FastifyInstance, FastifyServerOptions } from "fastify";
import { z } from "zod";
import { BadRequest, NotFound } from "http-errors";

import { FastifyZod, register } from "..";

const TodoItemId = z.object({
  id: z.string().uuid(),
});
type TodoItemId = z.infer<typeof TodoItemId>;

enum TodoStateEnum {
  Todo = `todo`,
  InProgress = `in progress`,
  Done = `done`,
}

const TodoState = z.nativeEnum(TodoStateEnum);

const TodoItem = TodoItemId.extend({
  label: z.string(),
  dueDate: z.date().optional(),
  state: TodoState,
});

type TodoItem = z.infer<typeof TodoItem>;

const TodoItems = z.object({
  todoItems: z.array(TodoItem),
});
type TodoItems = z.infer<typeof TodoItems>;

const TodoItemsGroupedByStatus = z.object({
  todo: z.array(TodoItem),
  inProgress: z.array(TodoItem),
  done: z.array(TodoItem),
});

type TodoItemsGroupedByStatus = z.infer<typeof TodoItemsGroupedByStatus>;

const schema = {
  TodoItemId,
  TodoState,
  TodoItem,
  TodoItems,
  TodoItemsGroupedByStatus,
};

// eslint-disable-next-line quotes
declare module "fastify" {
  interface FastifyInstance {
    readonly zod: FastifyZod<typeof schema>;
  }
}

export const createTestServer = (
  opts?: FastifyServerOptions,
): FastifyInstance => {
  const f = fastify(opts);

  register(f, {
    $id: `test-schema`,
    schema,
    swagger: {
      routePrefix: `/openapi`,
      openapi: {
        info: {
          title: `Zod Fastify Test Server`,
          description: `API for Zod Fastify Test Server`,
          version: `0.0.0`,
        },
      },
      exposeRoute: true,
      staticCSP: true,
    },
  });

  const state: TodoItems = {
    todoItems: [],
  };

  f.zod.get(
    `/item`,
    {
      operationId: `getTodoItems`,
      reply: {
        description: `The list of Todo Items`,
        key: `TodoItems`,
      },
    },
    async () => state,
  );

  f.zod.get(
    `/item/grouped-by-status`,
    {
      operationId: `getTodoItemsGroupedByStatus`,
      reply: `TodoItemsGroupedByStatus`,
    },
    async () => ({
      done: state.todoItems.filter((item) => item.state === `done`),
      inProgress: state.todoItems.filter(
        (item) => item.state === `in progress`,
      ),
      todo: state.todoItems.filter((item) => item.state === `todo`),
    }),
  );

  f.zod.post(
    `/item`,
    {
      operationId: `postTodoItem`,
      body: `TodoItem`,
      reply: `TodoItems`,
    },
    async ({ body: nextItem }) => {
      if (state.todoItems.some((prevItem) => prevItem.id === nextItem.id)) {
        throw new BadRequest(`item already exists`);
      }
      state.todoItems = [...state.todoItems, nextItem];
      return state;
    },
  );

  f.zod.put(
    `/item/:id`,
    {
      operationId: `putTodoItem`,
      body: `TodoItem`,
      params: `TodoItemId`,
      reply: `TodoItem`,
    },
    async ({ params: { id }, body: nextItem }) => {
      if (!state.todoItems.some((prevItem) => prevItem.id === id)) {
        throw new NotFound(`no such item`);
      }
      state.todoItems = state.todoItems.map((prevItem) =>
        prevItem.id === id ? nextItem : prevItem,
      );
      return nextItem;
    },
  );

  return f;
};
