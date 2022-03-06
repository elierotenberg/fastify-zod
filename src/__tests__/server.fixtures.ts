import fastify, { FastifyInstance, FastifyServerOptions } from "fastify";
import { BadRequest, NotFound } from "http-errors";

import { register } from "..";
import { FastifyZod, RegisterOptions } from "../FastifyZod";

import { models, TodoItems } from "./models.fixtures";

// eslint-disable-next-line quotes
declare module "fastify" {
  interface FastifyInstance {
    readonly zod: FastifyZod<typeof models>;
  }
}

export const swaggerOptions: RegisterOptions<typeof models>[`swaggerOptions`] =
  {
    routePrefix: `/swagger`,
    swagger: {
      info: {
        title: `Fastify Zod Test Server`,
        description: `Test Server for Fastify Zod`,
        version: `0.0.0`,
      },
    },
    staticCSP: true,
    exposeRoute: true,
  };

export const openApiOptions: RegisterOptions<typeof models>[`swaggerOptions`] =
  {
    openapi: {
      info: {
        title: `Fastify Zod Test Server`,
        description: `Test Server for Fastify Zod`,
        version: `0.0.0`,
      },
    },
    staticCSP: true,
    exposeRoute: true,
  };

export const createTestServer = (
  fastifyOptions: FastifyServerOptions,
  registerOptions: RegisterOptions<typeof models>,
): FastifyInstance => {
  const f = fastify(fastifyOptions);

  register(f, registerOptions);

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

  f.zod.get(
    `/42`,
    { operationId: `getFortyTwo`, reply: `FortyTwo` },
    async () => 42,
  );

  return f;
};
