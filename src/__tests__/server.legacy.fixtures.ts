import fastify, { FastifyInstance, FastifyServerOptions } from "fastify";
import fastifySwagger, { FastifyDynamicSwaggerOptions } from "fastify-swagger";
import { NotFound, BadRequest } from "http-errors";

import { buildJsonSchemas, withRefResolver } from "..";
import { BuildJsonSchemasOptions } from "../JsonSchema";

import {
  models,
  TodoItem,
  TodoItemId,
  TodoItems,
  TodoItemsGroupedByStatus,
} from "./models.fixtures";

export const createLegacyTestServer = (
  fastifyOptions: FastifyServerOptions,
  buildJsonSchemasOptions: BuildJsonSchemasOptions,
  swaggerOptions: FastifyDynamicSwaggerOptions,
): FastifyInstance => {
  const f = fastify(fastifyOptions);

  f.register(fastifySwagger, withRefResolver(swaggerOptions));

  const { $ref, schemas } = buildJsonSchemas(models, buildJsonSchemasOptions);

  for (const schema of schemas) {
    f.addSchema(schema);
  }

  const state: TodoItems = {
    todoItems: [],
  };

  f.get<{
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

  f.get<{
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
      done: state.todoItems.filter((item) => item.state === `done`),
      inProgress: state.todoItems.filter(
        (item) => item.state === `in progress`,
      ),
      todo: state.todoItems.filter((item) => item.state === `todo`),
    }),
  );

  f.post<{
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
      if (state.todoItems.some((prevItem) => prevItem.id === nextItem.id)) {
        throw new BadRequest(`item already exists`);
      }
      state.todoItems = [...state.todoItems, nextItem];
      return state;
    },
  );

  f.put<{
    Body: TodoItem;
    Params: TodoItemId;
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
