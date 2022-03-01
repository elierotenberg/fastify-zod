import {
  FastifyInstance,
  FastifyRequest,
  FastifySchema,
  HTTPMethods,
} from "fastify";
import fastifySwagger, { SwaggerOptions } from "fastify-swagger";
import { z, ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";

import { flattenJsonSchema, translateRef } from "./JsonSchema";

type Schema<Key extends string = string> = {
  readonly [K in Key]: ZodType<unknown>;
};

type SchemaKey<S extends Schema> = S extends Schema<infer Key> ? Key : never;

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
  readonly schema: S;
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

type RegisterOptions<S extends Schema> = {
  readonly $id: string;
  readonly schema: S;
  readonly swagger?: SwaggerOptions;
};

export const register = <S extends Schema>(
  f: FastifyInstance,
  { $id, schema, swagger }: RegisterOptions<S>,
): void => {
  const zodSchema = z.object(schema);
  const jsonSchema = {
    $id,
    ...zodToJsonSchema(zodSchema, {
      basePath: [`${$id}#`],
    }),
  };

  const jsonSchemas = flattenJsonSchema(jsonSchema);

  for (const jsonSchema of jsonSchemas) {
    f.addSchema(jsonSchema);
  }

  if (swagger) {
    f.register(fastifySwagger, {
      ...swagger,
      refResolver: {
        buildLocalReference: (json: { $id: string }) => json.$id,
      },
    } as unknown as SwaggerOptions);
  }

  const $ref = (
    key: string | { readonly description: string; readonly key: string },
  ): {
    readonly $ref: string;
    readonly description?: string;
  } =>
    typeof key === `string`
      ? {
          $ref: translateRef($id, `${$id}#/properties/${key}`),
        }
      : {
          $ref: translateRef($id, `${$id}#/properties/${key.key}`),
          description: key.description,
        };

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
          params: params ? $ref(params) : undefined,
          body: body ? $ref(body) : undefined,
          response: reply
            ? {
                200: $ref(reply),
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
      addRoute({ url, handler, method, schema, ...config });

  const pluginInstance: FastifyZod<S> = {
    delete: createAddRoute(`delete`),
    get: createAddRoute(`delete`),
    head: createAddRoute(`head`),
    options: createAddRoute(`options`),
    patch: createAddRoute(`patch`),
    post: createAddRoute(`post`),
    put: createAddRoute(`put`),
  };

  f.decorate(`zod`, pluginInstance);
};
