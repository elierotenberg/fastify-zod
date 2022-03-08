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
- Deduplication of structurally equivalent models
- Internal generated JSON Schemas available for reuse

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

const TodoItems = z.object({
  todoItems: z.array(TodoItem),
});

const TodoItemsGroupedByStatus = z.object({
  todo: z.array(TodoItem),
  inProgress: z.array(TodoItem),
  done: z.array(TodoItem),
});

const models = {
  TodoItemId,
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
    readonly zod: FastifyZod<typeof models>;
  }
}
```

- Register `fastify-zod` with optional config for `fastify-swagger`

```ts
import { buildJsonSchemas, register } from "fastify-zod";

const f = fastify();

register(f, {
  jsonSchemas: buildJsonSchemas(models),
  // optional, see below
  swagger: {
    openapi: {
      /* ... */
    },
    exposeRoute: true,
    transformSpec: {}, // optional, see below
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

- Generate transformed spec with first-class support for downstream `openapitools-generator`

```ts
const transformedSpecJson = await f
  .inject({
    method: `get`,
    url: `/documentation_transformed/json`,
  })
  .then((res) => res.body);

await writeFile(
  join(__dirname, `..`, `..`, `openapi.transformed.json`),
  transformedSpecJson,
  { encoding: `utf-8` }
);
```

- Generate OpenAPI Client with `openapitools-generator`

`openapi-generator-cli generate`

## API

### `buildJsonSchemas(models: Models, options: BuildJsonSchemasOptions = {}): BuildJonSchemaResult<typeof models>`

Build JSON Schemas and `$ref` function from Zod models.

The result can be used either with `register` (recommended, see [example in tests](./src/__tests__/server.fixtures.ts)) or directly with `fastify.addSchema` using the `$ref` function (legacy, see [example in tests](./src/__tests__/server.legacy.fixtures.ts)).

#### `Models`

Record mapping model keys to Zod types. Keys will be used to reference models in routes definitions.

Example:

```ts
const TodoItem = z.object({
  /* ... */
});
const TodoList = z.object({
  todoItems: z.array(TodoItem),
});

const models = {
  TodoItem,
  TodoList,
};
```

#### `BuildJsonSchemasOptions = {}`

##### `BuildJsonSchemasOptions.$id: string = "Schemas"`: `$id` of the generated schema (defaults to "Schemas")

##### `BuildJsonSchemasOptions.target: `jsonSchema7`|`openApi3` = "jsonSchema7"`: _jsonSchema7_ (default) or _openApi3_

Generates either `jsonSchema7` or `openApi3` schema. See [`zod-to-json-schema`](https://github.com/StefanTerdell/zod-to-json-schema#options-object).

#### `BuildJsonSchemasResult<typeof models> = { schemas: JsonSchema[], $ref: $ref<typeof models> }`

The result of `buildJsonSchemas` has 2 components: an array of schemas that can be added directly to fastify using `fastify.addSchema`, and a `$ref` function that returns a `{ $ref: string }` object that can be used directly.

If you simply pass the result to `register`, you won't have to care about this however.

```ts
const { schemas, $ref } = buildJsonSchemas(models, { $id: "MySchema" });

for (const schema of schemas) {
  fastify.addSchema(schema);
}

equals($ref("TodoItem"), {
  $ref: "MySchema#/properties/TodoItem",
});
```

### `buildJsonSchema($id: string, Type: ZodType)` (_deprecated_)

Shorthand to `buildJsonSchema({ [$id]: Type }).schemas[0]`.

### `register(f: FastifyInstance, { jsonSchemas, swaggerOptions?: = {} }: RegisterOptions`

Add schemas to `fastify` and decorate instance with `zod` property to add strongly-typed routes (see `fastify.zod` below).

### `RegisterOptions<typeof models>`

#### `RegisterOptions<typeof models>.jsonSchema`

The result of `buildJsonSchemas(models)` (see above).

##### `RegisterOptions<typeof models>.swaggerOptions = FastifyDynamicSwaggerOptions & { transformSpec: TransformSpecOptions }`

If present, this options will automatically register `fastify-swagger` in addition to `fastify.zod`.

Any options will be passed directly to `fastify-swagger` so you may refer to [their documentation](https://github.com/fastify/fastify-swagger).

In addition to `fastify-swagger` options, you can pass an additional property, `transformSpec`, to expose a transformed version of the original spec (see below).

```ts
register(f, {
  jsonSchemas: buildJsonSchemas(models),
  swaggerOptions: {
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
    transformSpec: {
      /* see below */
    },
  },
});
```

##### `TransformSpecOptions = { cache: boolean = false, routePrefix?: string, options?: TransformOptions }`

If this property is present on the `swaggerOptions`, then in addition to routes added to `fastify` by `fastify-swagger`, a transformed version of the spec is also exposed. The transformed version is semantically equivalent but benefits from several improvements, notably first-class support for `openapitools-generator-cli` (see below).

`cache` caches the transformed spec. As `SpecTransformer` can be computationally expensive, this may be useful if used in production. Defaults to `false`.

`routePrefix` is the route used to expose the transformed spec, similar to the `routePrefix` option of `fastify-swagger`. Defaults to `${swaggerOptions.routePrefix}_transformed`. Since `swaggerOptions.routePrefix` defaults to `/documentation`, then the default if no `routePrefix` is provided in either options is `/documentation_transformed`.
The exposed routes are `/${routePrefix}/json` and `/${routePrefix}/yaml` for JSON and YAML respectively versions of the transformed spec.

`options` are options passed to `SpecTransformer.transform` (see below). By default all transforms are applied.

## `fastify.zod.(delete|get|head|options|patch|post|put)(url: string, config: RouteConfig, handler)`

Add route with strong typing.

Example:

```ts
f.zod.put(
  "/:id",
  {
    operationId: "putTodoItem",
    params: "TodoItemId", // this is a key of "models" object above
    body: "TodoItem",
    reply: {
      description: "The updated todo item",
      key: "TodoItem",
    },
  },
  async ({ params: { id }, body: item }) => {
    /* ... */
  }
);
```

### withRefResolver: (options: FastifyDynamicSwaggerOptions) => FastifyDynamicSwaggerOptions

Wraps `fastify-swagger` options providing a sensible default [`refResolver` function](https://github.com/fastify/fastify-swagger#managing-your-refs) compatible with using the `$ref` function returned by buildJsonSchemas`.

`register` automatically uses this under the hood so this is only required if you are using the result of `buildJsonSchemas` directly without using `register`.

### SpecTransformer(spec: ApiSpec)

`SpecTransformer` takes an API spec (typically the output of `/openapi/json` when using `fastify-swagger`) and applies various transforms. This class is used under the hood by `register` when `swaggerOptions.transformSpec` is set so you probably don't need to use it directly.

The transforms should typically be semantically transparent (no semantic difference) but applies some spec-level optimization and most importantly works around the many quirks of the `typescript-fetch` generator of `openapitools-generator-cli`.

`SpecTransformer` is a stateful object that mutates itself internally, but the original spec object is not modified.

Available transforms:

- `rewriteSchemasAbsoluteRefs` transform

Transforms `$ref`s relative to a schema to refs relative to the global spec.

Example input:

```json
{
  "components": {
    "schemas": {
      "Schema": {
        "type": "object",
        "properties": {
          "Item": {
            /* ... */
          },
          "Items": {
            "type": "array",
            "items": {
              // "#" refers to "Schema" scope
              "$ref": "#/properties/Item"
            }
          }
        }
      }
    }
  }
}
```

Output:

```json
{
  "components": {
    "schemas": {
      "Schema": {
        "type": "object",
        "properties": {
          "Item": {
            /* ... */
          },
          "Items": {
            "type": "array",
            "items": {
              // "#" refers to global scope
              "$ref": "#/components/schemas/Schema/properties/Item"
            }
          }
        }
      }
    }
  }
}
```

- `extractSchemasProperties` transform

Extract `properties` of schemas into new schemas and rewrite all `$ref`s to point to the new schema.

Example input:

```json
{
  "components": {
    "schemas": {
      "Schema": {
        "type": "object",
        "properties": {
          "Item": {
            /* ... */
          },
          "Items": {
            "type": "array",
            "items": {
              "$ref": "#/components/schemas/Schema/properties/Item"
            }
          }
        }
      }
    }
  }
}
```

Output:

```json
{
  "components": {
    "schemas": {
      "Schema": {
        "type": "object",
        "properties": {
          "Item": {
            "$ref": "#/components/schemas/Schema_TodoItem"
          },
          "Items": {
            "$ref": "#/components/schemas/Schema_TodoItems"
          }
        }
      },
      "Schema_TodoItem": {
        /* ... */
      },
      "Schema_TodoItems": {
        "type": "array",
        "items": {
          "$ref": "#/components/schemas/Schema_TodoItem"
        }
      }
    }
  }
}
```

- `mergeRefs` transform

Finds deeply nested structures equivalent to existing schemas and replace them with `$ref`s to this schema. In practice this means deduplication and more importantly, referential equivalence in addition to structrural equivalence. This is especially useful for `enum`s since in TypeScript to equivalent enums are not assignable to each other.

Example input:

```json
{
  "components": {
    "schemas": {
      "TodoItemState": {
        "type": "string",
        "enum": ["todo", "in progress", "done"]
      },
      "TodoItem": {
        "type": "object",
        "properties": {
          "state": {
            "type": "string",
            "enum": ["todo", "in progress", "done"]
          }
        }
      }
    }
  }
}
{
  "mergeRefs": [{
    "$ref": "TodoItemState#"
  }]
}
```

Output:

```json
{
  "components": {
    "schemas": {
      "TodoItemState": {
        "type": "string",
        "enum": ["todo", "in progress", "done"]
      },
      "TodoItem": {
        "type": "object",
        "properties": {
          "state": {
            "$ref": "#/components/schemas/TodoItemState"
          }
        }
      }
    }
  }
}
```

In the typical case, you will not create each ref explicitly, but rather use the `$ref` function provided by `buildJsonSchemas`:

```ts
{
  mergeRefs: [$ref("TodoItemState")];
}
```

- `deleteUnusedSchemas` transform

Delete all schemas that are not referenced anywhere, including in `paths`. This is useful to remove leftovers of the previous transforms.

Example input:

```json
{
  "components": {
    "schemas": {
      // Schema_TodoItem has been extracted,
      // there are no references to this anymore
      "Schema": {
        "type": "object",
        "properties": {
          "TodoItem": {
            "$ref": "#/components/schemas/Schema_TodoItem"
          }
        }
      },
      "Schema_TodoItem": {
        /* ... */
      }
    }
  },
  "paths": {
    "/item": {
      "get": {
        "responses": {
          "200": {
            "content": {
              "application/json": {
                "schema": {
                  // This used to be #/components/Schema/properties/TodoItem
                  // but has been transformed by extractSchemasProperties
                  "$ref": "#/components/schemas/Schema_TodoItem"
                }
              }
            }
          }
        }
      }
    }
  }
}
```

Output:

```json
{
  "components": {
    "schemas": {
      // "Schema" has been deleted
      "Schema_TodoItem": {
        /* ... */
      }
    }
  },
  "paths": {
    /* ... */
  }
}
```

- `schemaKeys` option

This option controls the behavior of newly created schemas (e.g. during `extractSchemasProperties` transform).

Available configurations:

- `schemaKeys.removeInitialSchemasPrefix`: remove `schemaKey` prefix of initial schemas to create less verbose schema names, e.g. `TodoState` instead of `MySchema_TodoState`

- `schemaKeys.changeCase`: change case of generated schema keys. Defaults to `preserve`. In this case, original schema key and property key prefixes are preserved, and segments are underscore-separated.

In case of schema key conflict, an error will be thrown during `transform`.

#### SpecTransformer#transform(options: TransformOptions)

Applies the given transforms.

Default options:

```ts
{
  rewriteAbsoluteRefs?: boolean = true,
  extractSchemasProperties?: boolean = true,
  mergeRefs?: { $ref: string }[] = [],
  deleteUnusedSchemas?: boolean = true,
  schemaKeys?: {
    removeInitialSchemasPrefix: boolean = false,
    changeCase: "preserve" | "camelCase" | "PascalCase" | "snake_case" | "param-case" = "preserve"
  } = {}
}
```

All transforms default to `true` except `mergeRefs` that you must explicitly configure.

#### SpecTransformer#getSpec(): Spec

Return the current state of the spec. This is typically called after `transform` to use the transformed spec.

## Usage with `openapitools`

Together with `fastify-swagger`, and `SpecTransformer` this library supports downstream client code generation using `openapitools-generator-cli`.

Recommended use is with `register` and `fastify.inject`.

For this you need to first generate the spec file, then run `openapitools-generator`:

```ts
const jsonSchemas = buildJsonSchemas(models);

register(f, {
  jsonSchemas,
  swaggerOptions: {
    openapi: {
      /* ... */
    },
    exposeRoute: true,
    transformSpec: {
      routePrefix: "/openapi_transformed",
      options: {
        mergeRefs: [$ref("TodoItemState")],
      },
    },
  },
});

const spec = await f
  .inject({
    method: "get",
    url: "/openapi_transformed/json",
  })
  .then((spec) => spec.json());

writeFileSync("openapi-spec.json", JSON.stringify(spec), { encoding: "utf-8" });
```

`openapi-generator-cli generate`

We recommend running this as part as the build step of your app, see [package.json](./package.json).

## Caveats

Unfortunately and despite best efforts by `SpecTransformer`, the OpenAPI generator has many quirks and limited support for some features. Complex nested arrays are sometimes not validated / parsed correctly, discriminated unions have limited support, etc.

## License

MIT License Copyright (c) 2022 Elie Rotenberg
