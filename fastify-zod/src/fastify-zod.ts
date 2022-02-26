import { FastifyInstance, FastifyPluginCallback, HTTPMethods } from "fastify";
import { fastifySwagger, SwaggerOptions } from "fastify-swagger";
import { z } from "zod";

import { Definitions, Schema } from ".";

export const withFastifySwaggerRefResolver = (
  options: SwaggerOptions,
): SwaggerOptions =>
  ({
    ...options,
    refResolver: {
      buildLocalReference: (json: { $id: string }) => json.$id,
    },
  } as unknown as SwaggerOptions);

type HandlerParams<
  Key extends string,
  $defs extends Definitions<Key>,
  ParamsKey extends undefined | Key,
  BodyKey extends undefined | Key,
> = {
  readonly params: ParamsKey extends Key
    ? z.infer<$defs[ParamsKey]>
    : undefined;
  readonly body: BodyKey extends Key ? z.infer<$defs[BodyKey]> : undefined;
};

type Route<
  M extends HTTPMethods,
  Id extends string,
  Key extends string,
  $defs extends Definitions<Key>,
  ParamsKey extends undefined | Key,
  BodyKey extends undefined | Key,
  ReplyKey extends undefined | Key,
> = {
  readonly path: string;
  readonly method: M;
  readonly operationId: string;
  readonly description?: string;
  readonly schema: Schema<Id, Key, $defs>;
  readonly paramsKey: ParamsKey;
  readonly bodyKey: BodyKey;
  readonly replyKey: ReplyKey;
  readonly handler: (
    params: HandlerParams<Key, $defs, ParamsKey, BodyKey>,
  ) => Promise<ReplyKey extends Key ? z.infer<$defs[ReplyKey]> : undefined>;
};

export const register: FastifyPluginCallback<SwaggerOptions> = (
  f,
  options,
  done,
) => {
  try {
    f.register(fastifySwagger, {
      ...options,
      refResolver: {
        buildLocalReference: (json: { $id: string }) => json.$id,
      },
    } as unknown as SwaggerOptions);
    done();
  } catch (error) {
    done(error);
  }
};

export const addRoute = <
  M extends HTTPMethods,
  Id extends string,
  Key extends string,
  $defs extends Definitions<Key>,
  ParamsKey extends undefined | Key,
  BodyKey extends undefined | Key,
  ReplyKey extends undefined | Key,
>(
  f: FastifyInstance,
  {
    method,
    path,
    operationId,
    description,
    paramsKey,
    bodyKey,
    replyKey,
    schema: { $ref },
    handler,
  }: Route<M, Id, Key, $defs, ParamsKey, BodyKey, ReplyKey>,
): void => {
  f.route<{
    Params: ParamsKey extends Key ? z.infer<$defs[ParamsKey]> : undefined;
    Body: BodyKey extends Key ? z.infer<$defs[BodyKey]> : undefined;
    Reply: ReplyKey extends Key ? z.infer<$defs[ReplyKey]> : undefined;
  }>({
    method,
    url: path,
    schema: {
      operationId,
      description,
      params: paramsKey
        ? $ref(paramsKey as Exclude<ParamsKey, undefined>)
        : undefined,
      body: bodyKey ? $ref(bodyKey as Exclude<BodyKey, undefined>) : undefined,
      response: replyKey
        ? {
            200: $ref(replyKey as Exclude<ReplyKey, undefined>),
          }
        : undefined,
    },
    handler,
  });
};
