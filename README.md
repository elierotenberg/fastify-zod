# fastify-zod

## Why?

`fastify` is awesome and arguably the best Node http server around.

`zod` is awesome and arguably the best TypeScript modeling / validation library around.

Unfortunately, `fastify` and `zod` don't work together very well. [`fastify` suggests using `@sinclair/typebox`](https://www.fastify.io/docs/latest/TypeScript/#typebox), which is nice but is nowhere close to `zod`. This library allows you to use `zod` as your primary source of truth for models with nice integration with `fastify`, `fastify-swagger` and OpenAPI `typescript-fetch` generator.

## Features

- Define your models using `zod` in a single place, without redundancy / conflicting sources of truth
- Use your models in busines logic code and get out of the box type-safety in `fastify`
- First-class support for `fastify-swagger` and `openapitools-generator/typescrip-fetch`
- Referential transparency, including for `enum`s

## Setup

- Install `fastify-zod`

```
npm i fastify-zod`
```

- Define your models using `zod`

```ts
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
```

- Merge `fastify` types (as recommended by `fastify`)

```ts
import type { FastifyZod } from "fastify-zod";

declare module "fastify" {
  interface FastifyInstance {
    readonly zod: FastifyZod<typeof schema>;
  }
}
```

- Register `fastify-zod` with optional config for `fastify-swagger`

```ts
import { register } from "fastify-zod";

const f = fastify();

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
```

- Define fastify routes using simplified syntax and get automatic type inference

```ts
f.zod.post(
  `/item`,
  {
    operationId: `postTodoItem`,
    body: `TodoItem`,
    reply: `TodoItems`,
  },
  async ({ body: nextItem }) => {
    /* body is correctly inferred as TodoItem */
    if (state.todoItems.some((prevItem) => prevItem.id === nextItem.id)) {
      throw new BadRequest(`item already exists`);
    }
    state.todoItems = [...state.todoItems, nextItem];
    /* reply is typechecked against TodoItems */
    return state;
  }
);
```

## Usage with `openapitools`

Together with `fastify-swagger`, this library supports downstream client code generation using `openapitools-generator`.

For this you need to first generate the spec file, then run `openapitools-generator`:

```ts
const spec = await f
  .inject({
    method: "get",
    url: "/openapi/json",
  })
  .then((spec) => spec.json());

writeFileSync("openapi-spec.json", JSON.stringify(spec), { encoding: "utf-8" });
```

We recommend running this as part as the build step of your app, see [package.json](./package-json).

## Caveats

Due to limitations in `openapitools-generator`, it is not possible to use JSON pointers (e.g. `#!/components/schemas/my-schema/nested/path`). To achieve downstream support, we "flatten" the generated JSON Schema to avoid using pointers. Hence the generated models tend to be relatively verbose, but should yet remain human-readable.

## License

MIT License Copyright (c) 2022 Elie Rotenberg
