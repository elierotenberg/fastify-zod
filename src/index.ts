import {
  FastifyInstance,
  FastifyRequest,
  FastifySchema,
  HTTPMethods,
} from "fastify";
import fastifySwagger, { SwaggerOptions } from "fastify-swagger";
import { z, ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { flattenJsonSchema, JsonSchema } from "./JsonSchema";

type Schema<Key extends string = string> = {
  readonly [K in Key]: ZodType<unknown>;
};

type SchemaKey<S extends Schema> = S extends Schema<infer Key>
  ? Key & string
  : never;
type SchemaKeyOrDescription<S extends Schema> =
  | SchemaKey<S>
  | {
      readonly description: string;
      readonly key: SchemaKey<S>;
    };

type SchemaType<S extends Schema, Key extends SchemaKey<S>> = z.infer<S[Key]>;

type SchemaTypeOption<
  S extends Schema,
  Key extends void | SchemaKey<S>,
> = Key extends SchemaKey<S> ? SchemaType<S, Key> : void;

type RouteHandlerParams<
  S extends Schema,
  Params extends void | SchemaKey<S>,
  Body extends void | SchemaKey<S>,
> = FastifyRequest & {
  readonly params: SchemaTypeOption<S, Params>;
  readonly body: SchemaTypeOption<S, Body>;
};

type RouteHandler<
  S extends Schema,
  Params extends void | SchemaKey<S>,
  Body extends void | SchemaKey<S>,
  Reply extends void | SchemaKey<S>,
> = (
  params: RouteHandlerParams<S, Params, Body>,
) => Promise<SchemaTypeOption<S, Reply>>;

type RouteConfig<
  S extends Schema = Schema,
  M extends Lowercase<HTTPMethods> = Lowercase<HTTPMethods>,
  Params extends void | SchemaKey<S> = void,
  Body extends void | SchemaKey<S> = void,
  Reply extends void | SchemaKey<S> = void,
> = {
  readonly url: string;
  readonly method: M;
  readonly operationId: string;
  readonly description?: string;
  readonly params?:
    | Exclude<Params, void>
    | {
        readonly description: string;
        readonly key: Exclude<Params, void>;
      };
  readonly body?:
    | Exclude<Body, void>
    | {
        readonly description: string;
        readonly key: Exclude<Body, void>;
      };
  readonly reply?:
    | Exclude<Reply, void>
    | {
        readonly description: string;
        readonly key: Exclude<Reply, void>;
      };
  readonly handler: RouteHandler<S, Params, Body, Reply>;
} & FastifySchema;

export type FastifyZod<S extends Schema> = {
  readonly [M in Lowercase<HTTPMethods>]: <
    Params extends void | SchemaKey<S> = void,
    Body extends void | SchemaKey<S> = void,
    Reply extends void | SchemaKey<S> = void,
  >(
    url: string,
    config: Omit<
      RouteConfig<S, M, Params, Body, Reply>,
      `url` | `method` | `schema` | `handler`
    >,
    handler: RouteHandler<S, Params, Body, Reply>,
  ) => void;
};

type BuildJsonSchemasOptions = {
  readonly target?: `jsonSchema7` | `openApi3`;
};

type $ref<S extends Schema> = (key: SchemaKeyOrDescription<S>) => {
  readonly $ref: string;
  readonly description?: string;
};

type BuildJsonSchemasResult<S extends Schema> = {
  readonly $ref: $ref<S>;
  readonly schemas: JsonSchema[];
};

/**
 * @deprecated
 */
export const buildJsonSchema = <$id extends string, T>(
  Type: ZodType<T>,
  $id: $id,
): JsonSchema => buildJsonSchemas({ [$id]: Type }).schemas[0];

export const buildJsonSchemas = <S extends Schema>(
  schema: S,
  { target }: BuildJsonSchemasOptions = {},
): BuildJsonSchemasResult<S> => {
  const zodSchema = z.object(schema);
  const root: JsonSchema = {
    $id: ``,
    ...zodToJsonSchema(zodSchema, {
      target: target ?? `jsonSchema7`,
    }),
  };

  const schemas = flattenJsonSchema(root);

  const $ref: $ref<S> = (key) =>
    typeof key === `string`
      ? {
          $ref: `${key}#`,
        }
      : {
          $ref: `${key.key}#`,
          description: key.description,
        };

  return {
    schemas,
    $ref,
  };
};
export type RegisterOptions<S extends Schema> = {
  readonly jsonSchemas: BuildJsonSchemasResult<S>;
  readonly swagger?: SwaggerOptions;
};

export const register = <S extends Schema>(
  f: FastifyInstance,
  { jsonSchemas: { schemas, $ref }, swagger }: RegisterOptions<S>,
): void => {
  for (const schema of schemas) {
    f.addSchema(schema);
  }

  if (swagger) {
    f.register(fastifySwagger, {
      ...swagger,
      refResolver: {
        buildLocalReference: (json: { $id: string }) => json.$id,
      },
    } as unknown as SwaggerOptions);
  }

  const addRoute = <
    M extends Lowercase<HTTPMethods> = Lowercase<HTTPMethods>,
    Params extends void | SchemaKey<S> = void,
    Body extends void | SchemaKey<S> = void,
    Reply extends void | SchemaKey<S> = void,
  >({
    method,
    url,
    operationId,
    params,
    body,
    reply,
    handler,
    ...fastifySchema
  }: RouteConfig<S, M, Params, Body, Reply>): void => {
    f[method]<{
      Params: SchemaTypeOption<S, Params>;
      Body: SchemaTypeOption<S, Body>;
      Reply: SchemaTypeOption<S, Reply>;
    }>(
      url,
      {
        schema: {
          operationId,
          params: params
            ? $ref(params as SchemaKeyOrDescription<S>)
            : undefined,
          body: body ? $ref(body as SchemaKeyOrDescription<S>) : undefined,
          response: reply
            ? {
                200: $ref(reply as SchemaKeyOrDescription<S>),
              }
            : undefined,
          ...fastifySchema,
        },
      },
      handler,
    );
  };

  const createAddRoute =
    <M extends Lowercase<HTTPMethods>>(method: M): FastifyZod<S>[M] =>
    (url, config, handler) =>
      addRoute({ url, handler, method, ...config });

  const pluginInstance: FastifyZod<S> = {
    delete: createAddRoute(`delete`),
    get: createAddRoute(`get`),
    head: createAddRoute(`head`),
    options: createAddRoute(`options`),
    patch: createAddRoute(`patch`),
    post: createAddRoute(`post`),
    put: createAddRoute(`put`),
  };

  f.decorate(`zod`, pluginInstance);
};
