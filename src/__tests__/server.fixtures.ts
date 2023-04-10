import fastify, { FastifyInstance, FastifyServerOptions } from "fastify";
import { BadRequest, NotFound } from "http-errors";

import { register } from "..";
import { RegisterOptions } from "../FastifyZod";

import { models, TodoItems } from "./models.fixtures";

export const swaggerOptions: RegisterOptions<typeof models>[`swaggerOptions`] =
  {
    swagger: {
      info: {
        title: `Fastify Zod Test Server`,
        description: `Test Server for Fastify Zod`,
        version: `0.0.0`,
      },
    },
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
  };

export const swaggerUiOptions: RegisterOptions<
  typeof models
>[`swaggerUiOptions`] = {
  staticCSP: true,
};

export const createTestServer = async (
  fastifyOptions: FastifyServerOptions,
  registerOptions: RegisterOptions<typeof models>,
): Promise<FastifyInstance> => {
  const f = await register(fastify(fastifyOptions), registerOptions);

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

  f.zod.get(
    `/item/:id`,
    {
      operationId: `getTodoItem`,
      params: `TodoItemId`,
      response: {
        200: `TodoItem`,
        404: `TodoItemNotFoundError`,
      },
    },
    async ({ params: { id } }, reply) => {
      const item = state.todoItems.find((item) => item.id === id);
      if (item) {
        return item;
      }
      reply.code(404);
      return {
        id,
        message: `item not found`,
      };
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
