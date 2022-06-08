import {
  FastifyInstance,
  FastifyRequest,
  FastifySchema,
  HTTPMethods,
} from "fastify";
import fastifySwagger, { FastifyDynamicSwaggerOptions } from "@fastify/swagger";
import * as yaml from "js-yaml";

import { SpecTransformer, TransformOptions } from "./SpecTransformer";
import { BuildJsonSchemasResult } from "./JsonSchema";
import {
  Models,
  SchemaKey,
  SchemaKeyOrDescription,
  SchemaTypeOption,
} from "./Models";

export type RegisterOptions<S extends Models> = {
  readonly jsonSchemas: BuildJsonSchemasResult<S>;
  readonly swaggerOptions?: FastifyDynamicSwaggerOptions & {
    readonly transformSpec?: {
      readonly cache?: boolean;
      readonly routePrefix?: string;
      readonly options?: TransformOptions;
    };
  };
};
type RouteHandlerParams<
  M extends Models,
  Params extends void | SchemaKey<M>,
  Body extends void | SchemaKey<M>,
  Querystring extends void | SchemaKey<M>,
> = FastifyRequest<{
  Params: SchemaTypeOption<M, Params>;
  Body: SchemaTypeOption<M, Body>;
  Querystring: SchemaTypeOption<M, Querystring>;
}>;

type RouteHandler<
  M extends Models,
  Params extends void | SchemaKey<M>,
  Body extends void | SchemaKey<M>,
  Reply extends void | SchemaKey<M>,
  Querystring extends void | SchemaKey<M>,
> = (
  params: RouteHandlerParams<M, Params, Body, Querystring>,
) => Promise<SchemaTypeOption<M, Reply>>;

type RouteConfig<
  M extends Models = Models,
  Method extends Lowercase<HTTPMethods> = Lowercase<HTTPMethods>,
  Params extends void | SchemaKey<M> = void,
  Body extends void | SchemaKey<M> = void,
  Reply extends void | SchemaKey<M> = void,
  Querystring extends void | SchemaKey<M> = void,
> = {
  readonly url: string;
  readonly method: Method;
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
  readonly querystring?:
    | Exclude<Querystring, void>
    | {
        readonly description: string;
        readonly key: Exclude<Querystring, void>;
      };
  readonly handler: RouteHandler<M, Params, Body, Reply, Querystring>;
} & FastifySchema;

export type FastifyZod<M extends Models> = {
  readonly [Method in Lowercase<HTTPMethods>]: <
    Params extends void | SchemaKey<M> = void,
    Body extends void | SchemaKey<M> = void,
    Reply extends void | SchemaKey<M> = void,
    Querystring extends void | SchemaKey<M> = void,
  >(
    url: string,
    config: Omit<
      RouteConfig<M, Method, Params, Body, Reply, Querystring>,
      `url` | `method` | `schema` | `handler`
    >,
    handler: RouteHandler<M, Params, Body, Reply, Querystring>,
  ) => void;
};

export type FastifyZodInstance<M extends Models> = FastifyInstance & {
  readonly zod: FastifyZod<M>;
};

export const withRefResolver = (
  options: FastifyDynamicSwaggerOptions,
): FastifyDynamicSwaggerOptions => ({
  ...options,
  refResolver: {
    ...options.refResolver,
    clone: true,
    buildLocalReference: (json, _baseUri, _fragment, i) =>
      typeof json.$id === `string` ? json.$id : `def-${i}`,
  },
});

export const register = <S extends Models>(
  f: FastifyInstance,
  { jsonSchemas: { schemas, $ref }, swaggerOptions }: RegisterOptions<S>,
): FastifyZodInstance<S> => {
  for (const schema of schemas) {
    f.addSchema(schema);
  }

  if (swaggerOptions) {
    const { transformSpec, ...baseSwaggerOptions } = swaggerOptions;

    f.register(fastifySwagger, withRefResolver(baseSwaggerOptions));

    if (transformSpec) {
      const originalRoutePrefix =
        baseSwaggerOptions.routePrefix ?? `/documentation`;
      const transformedRoutePrefix =
        transformSpec.routePrefix ?? `${originalRoutePrefix}_transformed`;

      const fetchTransformedSpec = async (): Promise<unknown> => {
        const originalSpec = await f
          .inject({
            method: `get`,
            url: `${baseSwaggerOptions.routePrefix ?? `documentation`}/json`,
          })
          .then((res) => res.json());
        const t = new SpecTransformer(originalSpec);
        return t.transform(transformSpec.options);
      };

      let cachedTransformedSpec: null | Promise<unknown> = null;
      const getTransformedSpec = async (): Promise<unknown> => {
        if (!transformSpec.cache) {
          return await fetchTransformedSpec();
        }
        if (!cachedTransformedSpec) {
          cachedTransformedSpec = fetchTransformedSpec();
        }
        return await cachedTransformedSpec;
      };

      let cachedTransformedSpecJson: null | string = null;
      const getTransformedSpecJson = async (): Promise<string> => {
        const transformedSpec = await getTransformedSpec();
        if (!transformSpec.cache) {
          return JSON.stringify(transformedSpec, null, 2);
        }
        if (!cachedTransformedSpecJson) {
          cachedTransformedSpecJson = JSON.stringify(transformedSpec, null, 2);
        }
        return cachedTransformedSpecJson;
      };

      let cachedTransformedSpecYaml: null | string = null;
      const getTransformedSpecYaml = async (): Promise<string> => {
        const transformedSpec = await getTransformedSpec();
        if (!transformSpec.cache) {
          return yaml.dump(transformedSpec);
        }
        if (!cachedTransformedSpecYaml) {
          cachedTransformedSpecYaml = yaml.dump(transformedSpec);
        }
        return cachedTransformedSpecYaml;
      };

      f.get(`${transformedRoutePrefix}/json`, async (_request, reply) => {
        reply.type(`application/json`);
        return await getTransformedSpecJson();
      });

      f.get(`${transformedRoutePrefix}/yaml`, async (_request, reply) => {
        reply.type(`text/x-yaml`);
        return await getTransformedSpecYaml();
      });
    }
  }

  const addRoute = <
    M extends Lowercase<HTTPMethods> = Lowercase<HTTPMethods>,
    Params extends void | SchemaKey<S> = void,
    Body extends void | SchemaKey<S> = void,
    Reply extends void | SchemaKey<S> = void,
    Querystring extends void | SchemaKey<S> = void,
  >({
    method,
    url,
    operationId,
    params,
    body,
    reply,
    querystring,
    handler,
    ...fastifySchema
  }: RouteConfig<S, M, Params, Body, Reply, Querystring>): void => {
    f[method]<{
      Params: SchemaTypeOption<S, Params>;
      Body: SchemaTypeOption<S, Body>;
      Reply: SchemaTypeOption<S, Reply>;
      Querystring: SchemaTypeOption<S, Querystring>;
    }>(
      url,
      {
        schema: {
          operationId,
          params: params
            ? $ref(params as SchemaKeyOrDescription<S>)
            : undefined,
          body: body ? $ref(body as SchemaKeyOrDescription<S>) : undefined,
          querystring: querystring
            ? $ref(querystring as SchemaKeyOrDescription<S>)
            : undefined,
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

  return f as FastifyZodInstance<S>;
};
