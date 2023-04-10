import { IncomingMessage, ServerResponse } from "http";

import {
  FastifyInstance,
  FastifyRequest,
  FastifySchema,
  HTTPMethods as FastifyHTTPMethods,
  RouteHandlerMethod,
  FastifyReply,
  RawServerBase,
} from "fastify";
import fastifySwagger, { FastifyDynamicSwaggerOptions } from "@fastify/swagger";
import fastifySwaggerUi, { FastifySwaggerUiOptions } from "@fastify/swagger-ui";
import * as yaml from "js-yaml";

import { SpecTransformer, TransformOptions } from "./SpecTransformer";
import { $Ref, BuildJsonSchemasResult } from "./JsonSchema";
import {
  Models as M_,
  SchemaKey,
  SchemaKeyOrDescription,
  SchemaTypeOption,
} from "./Models";

export type RegisterOptions<M extends M_> = {
  readonly jsonSchemas: BuildJsonSchemasResult<M>;
  readonly transformSpec?: {
    readonly cache?: boolean;
    readonly routePrefix?: string;
    readonly options?: TransformOptions;
  };
  readonly swaggerOptions?: FastifyDynamicSwaggerOptions;
  readonly swaggerUiOptions?: false | FastifySwaggerUiOptions;
};

type V_ = Lowercase<FastifyHTTPMethods> & keyof FastifyInstance;

type P_<M extends M_> = void | SchemaKey<M>;
type B_<M extends M_> = void | SchemaKey<M>;
type Q_<M extends M_> = void | SchemaKey<M>;
type R_<M extends M_> = void | SchemaKey<M>;
type Rx_<M extends M_> = void | Record<number, void | SchemaKey<M>>;

type FatifyZodRouteGenericInterface<
  M extends M_,
  P extends P_<M>,
  B extends B_<M>,
  Q extends Q_<M>,
  R extends R_<M>,
  Rx extends Rx_<M>,
> = {
  Params: SchemaTypeOption<M, P>;
  Body: SchemaTypeOption<M, B>;
  Reply: SchemaTypeOption<
    M,
    R | (Rx extends Record<number, unknown> ? Rx[number] : never)
  >;
  Querystring: SchemaTypeOption<M, Q>;
};

type RouteHandlerParams<
  M extends M_,
  P extends P_<M>,
  B extends B_<M>,
  Q extends Q_<M>,
  R extends R_<M>,
  Rx extends Rx_<M>,
> = FastifyRequest<FatifyZodRouteGenericInterface<M, P, B, Q, R, Rx>>;

type RouteHandler<
  M extends M_,
  P extends P_<M>,
  B extends B_<M>,
  Q extends Q_<M>,
  R extends R_<M>,
  Rx extends Rx_<M>,
> = (
  params: RouteHandlerParams<M, P, B, Q, R, Rx>,
  reply: FastifyReply<
    RawServerBase,
    IncomingMessage,
    ServerResponse,
    FatifyZodRouteGenericInterface<M, P, B, Q, R, Rx>
  >,
) => Promise<
  SchemaTypeOption<
    M,
    R | (Rx extends Record<number, unknown> ? Rx[number] : never)
  >
>;

type RouteConfig<
  M extends M_,
  V extends V_,
  P extends P_<M>,
  B extends B_<M>,
  Q extends Q_<M>,
  R extends R_<M>,
  Rx extends Rx_<M>,
> = {
  readonly url: string;
  readonly method: V;
  readonly operationId: string;
  readonly description?: string;
  readonly params?:
    | Exclude<P, void>
    | {
        readonly description: string;
        readonly key: Exclude<P, void>;
      };
  readonly body?:
    | Exclude<B, void>
    | {
        readonly description: string;
        readonly key: Exclude<B, void>;
      };
  readonly querystring?:
    | Exclude<Q, void>
    | {
        readonly description: string;
        readonly key: Exclude<Q, void>;
      };
  readonly reply?:
    | Exclude<R, void>
    | {
        readonly description: string;
        readonly key: Exclude<R, void>;
      };
  readonly response?: Rx extends Record<number, unknown>
    ? {
        readonly [Code in keyof Rx]:
          | Exclude<Rx[Code], void>
          | {
              readonly description: string;
              readonly key: Exclude<Rx[Code], void>;
            };
      }
    : void;
  readonly handler: RouteHandler<M, P, B, Q, R, Rx>;
} & FastifySchema;

export type FastifyZod<M extends M_> = {
  readonly [Method in V_]: <
    P extends P_<M>,
    B extends B_<M>,
    Q extends Q_<M>,
    R extends R_<M>,
    Rx extends Rx_<M>,
  >(
    url: string,
    config: Omit<
      RouteConfig<M, Method, P, B, Q, R, Rx>,
      `url` | `method` | `schema` | `handler`
    >,
    handler: RouteHandler<M, P, B, Q, R, Rx>,
  ) => void;
};

export type FastifyZodInstance<M extends M_> = FastifyInstance & {
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

export const register = async <M extends M_>(
  f: FastifyInstance,
  {
    jsonSchemas: { schemas, $ref },
    swaggerOptions,
    swaggerUiOptions,
    transformSpec,
  }: RegisterOptions<M>,
): Promise<FastifyZodInstance<M>> => {
  for (const schema of schemas) {
    f.addSchema(schema);
  }
  await f.register(fastifySwagger, withRefResolver(swaggerOptions ?? {}));
  if (swaggerUiOptions !== false) {
    await f.register(fastifySwaggerUi, swaggerUiOptions ?? {});

    if (transformSpec) {
      const originalRoutePrefix =
        swaggerUiOptions?.routePrefix ?? `/documentation`;
      const transformedRoutePrefix =
        transformSpec.routePrefix ?? `${originalRoutePrefix}_transformed`;

      const fetchTransformedSpec = async (): Promise<unknown> => {
        const originalSpec = await f
          .inject({
            method: `get`,
            url: `${swaggerUiOptions?.routePrefix ?? `documentation`}/json`,
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
    V extends V_,
    P extends P_<M>,
    B extends B_<M>,
    Q extends Q_<M>,
    R extends R_<M>,
    Rx extends Rx_<M>,
  >({
    method,
    url,
    operationId,
    params,
    body,
    reply,
    response,
    querystring,
    handler,
    ...fastifySchema
  }: RouteConfig<M, V, P, B, Q, R, Rx>): void => {
    const customSchema: FastifySchema = {};
    if (operationId) {
      customSchema.operationId = operationId;
    }
    if (params) {
      customSchema.params = $ref(params as SchemaKeyOrDescription<M>);
    }
    if (body) {
      customSchema.body = $ref(body as SchemaKeyOrDescription<M>);
    }
    if (querystring) {
      customSchema.querystring = $ref(querystring as SchemaKeyOrDescription<M>);
    }
    if (reply || response) {
      const customSchemaResponse: Record<number, ReturnType<$Ref<M>>> = {};
      if (reply) {
        customSchemaResponse[200] = $ref(reply as SchemaKeyOrDescription<M>);
      }
      if (response) {
        for (const code of Object.keys(response)) {
          customSchemaResponse[parseInt(code)] = $ref(
            response[parseInt(code)] as SchemaKeyOrDescription<M>,
          );
        }
      }
      customSchema.response = customSchemaResponse;
    }

    f[method]<{
      Params: SchemaTypeOption<M, P>;
      Body: SchemaTypeOption<M, B>;
      Querystring: SchemaTypeOption<M, B>;
      Reply: SchemaTypeOption<
        M,
        R | (Rx extends Record<number, unknown> ? Rx[number] : never)
      >;
    }>(
      url,
      {
        schema: {
          ...customSchema,
          ...fastifySchema,
        },
      },
      handler as RouteHandlerMethod,
    );
  };

  const createAddRoute =
    <Method extends V_>(method: Method): FastifyZod<M>[Method] =>
    (url, config, handler) =>
      addRoute({ url, handler, method, ...config });

  const pluginInstance: FastifyZod<M> = {
    delete: createAddRoute(`delete`),
    get: createAddRoute(`get`),
    head: createAddRoute(`head`),
    options: createAddRoute(`options`),
    patch: createAddRoute(`patch`),
    post: createAddRoute(`post`),
    put: createAddRoute(`put`),
  };

  f.decorate(`zod`, pluginInstance);

  return f as FastifyZodInstance<M>;
};
