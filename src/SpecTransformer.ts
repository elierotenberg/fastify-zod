import { z } from "zod";
import deepEqual from "fast-deep-equal";

import {
  deleteAtPath,
  equalPath,
  getAtPath,
  getAtPathSafe,
  getChildPath,
  matchPathPrefix,
  replacePathPrefix,
  setAtPath,
} from "./Path";
import { isZod, mapDeep, visitDeep } from "./util";

const $refPattern = /^[^#]*#(\/[^\/]+)*$/;

const $Ref = z.string().regex($refPattern);
type $Ref = z.infer<typeof $Ref>;

const Ref = z.object({
  $ref: $Ref,
});
type Ref = z.infer<typeof Ref>;
const isRef = isZod(Ref);

type RefPath = {
  readonly basePath: string;
  readonly path: string[];
};

const toRefPath = ($ref: string): RefPath => {
  const indexOfPath = $ref.indexOf(`#`);
  return {
    basePath: $ref.slice(0, indexOfPath),
    path: $ref
      .slice(indexOfPath + 1)
      .split(`/`)
      .slice(1),
  };
};

const toRef = (refPath: RefPath): Ref => ({
  $ref: [`${refPath.basePath}#`, ...refPath.path].join(`/`),
});

const SpecSchema = z
  .object({
    properties: z.record(z.unknown()).optional(),
    required: z.array(z.string()).optional(),
  })
  .passthrough();
type SpecSchema = z.infer<typeof SpecSchema>;

const SpecSchemas = z.record(SpecSchema);
type SpecSchemas = z.infer<typeof SpecSchemas>;

const SpecPaths = z.record(z.unknown());

const OpenApiSpec = z
  .object({
    components: z
      .object({
        schemas: SpecSchemas,
      })
      .passthrough(),
    paths: SpecPaths,
  })
  .passthrough();

const isOpenApiSpec = isZod(OpenApiSpec);

const SwaggerSpec = z
  .object({
    definitions: SpecSchemas,
    paths: SpecPaths,
  })
  .passthrough();

export const Spec = z.union([OpenApiSpec, SwaggerSpec]);
type Spec = z.infer<typeof Spec>;

type Transform = () => number;

type TransformStrategy = boolean | `shallow` | `recursive`;

const transform = (fn: Transform, depth: TransformStrategy): number => {
  if (!depth) {
    return 0;
  }
  if (depth === true || depth === `shallow`) {
    return fn();
  }
  let totalCount = 0;
  while (true) {
    const count = fn();
    if (count === 0) {
      return totalCount;
    }
    totalCount += count;
  }
};

const deepClone = (spec: Spec): Spec => JSON.parse(JSON.stringify(spec));

export type TransformOptions = {
  readonly rewriteSchemasAbsoluteRefs?: boolean;
  readonly extractSchemasProperties?: TransformStrategy;
  readonly mergeSchemas?: TransformStrategy;
  readonly deleteUnusedSchemas?: boolean;
};

export class SpecTransformer {
  private readonly spec: Spec;

  public constructor(spec: Spec) {
    this.spec = deepClone(spec);
  }

  private readonly getSchemas = (): SpecSchemas => {
    return isOpenApiSpec(this.spec)
      ? this.spec.components.schemas
      : this.spec.definitions;
  };

  private readonly getSchemaKeys = (): string[] =>
    Object.keys(this.getSchemas());

  private readonly getSchema = (schemaKey: string): SpecSchema => {
    const schema = this.getSchemas()[schemaKey];
    if (!schema) {
      throw new Error(`schema(schemaKey='${schemaKey}') not found`);
    }
    return schema;
  };

  private readonly getSchemaPath = (schemaKey: string): string[] =>
    isOpenApiSpec(this.spec)
      ? [`components`, `schemas`, schemaKey]
      : [`definitions`, schemaKey];

  private readonly countSchemaProperRefs = (schemaKey: string): number => {
    const schemaPath = this.getSchemaPath(schemaKey);
    let count = 0;
    visitDeep(this.spec, (value, path) => {
      if (equalPath(path, schemaPath)) {
        return false;
      }
      if (isRef(value)) {
        const refPath = toRefPath(value.$ref);
        if (
          refPath.basePath.length === 0 &&
          matchPathPrefix(schemaPath, refPath.path)
        ) {
          count++;
        }
      }
      return true;
    });

    return count;
  };

  private readonly deleteUnusedSchemas = (): number => {
    for (const schemaKey of this.getSchemaKeys()) {
      if (this.countSchemaProperRefs(schemaKey) === 0) {
        deleteAtPath(this.spec, this.getSchemaPath(schemaKey));
        return 1 + this.deleteUnusedSchemas();
      }
    }
    return 0;
  };

  private readonly rewriteSchemaAbsoluteRefs = (schemaKey: string): number => {
    const schema = this.getSchema(schemaKey);
    const schemaPath = this.getSchemaPath(schemaKey);
    let count = 0;
    mapDeep(schema, (prevValue) => {
      if (isRef(prevValue)) {
        const refPath = toRefPath(prevValue.$ref);
        if (
          refPath.basePath.length === 0 &&
          !matchPathPrefix(schemaPath, refPath.path)
        ) {
          const nextPath = getChildPath(schemaPath, ...refPath.path);
          count++;
          return toRef({
            basePath: ``,
            path: nextPath,
          });
        }
      }
      return prevValue;
    });
    return count;
  };
  private readonly rewriteSchemasAbsoluteRefs = (): number => {
    let count = 0;
    for (const schemaKey of this.getSchemaKeys()) {
      count += this.rewriteSchemaAbsoluteRefs(schemaKey);
    }
    return count;
  };

  private readonly extractSchemaPathAsSchema = (
    prevSchemaKey: string,
    prevRelativePath: string[],
    nextSchemaKey: string,
  ): number => {
    const prevPath = getChildPath(
      this.getSchemaPath(prevSchemaKey),
      ...prevRelativePath,
    );

    const value = getAtPath(this.spec, prevPath);
    const nextPath = this.getSchemaPath(nextSchemaKey);

    const [prevValueFound, prevValue] = getAtPathSafe(this.spec, nextPath);

    if (prevValueFound) {
      if (!deepEqual(value, prevValue)) {
        throw new Error(
          `schema(schemaKey='${nextSchemaKey}') already exists with a different value`,
        );
      }
    } else {
      setAtPath(this.spec, nextPath, value);
    }

    setAtPath(this.spec, prevPath, toRef({ basePath: ``, path: nextPath }));

    let count = 0;
    mapDeep(this.spec, (value) => {
      if (isRef(value)) {
        const refPath = toRefPath(value.$ref);
        if (
          refPath.basePath.length === 0 &&
          matchPathPrefix(prevPath, refPath.path)
        ) {
          count++;
          return toRef({
            basePath: ``,
            path: replacePathPrefix(prevPath, nextPath, refPath.path),
          });
        }
      }
      return value;
    });
    return count;
  };

  private readonly extractSchemaProperties = (schemaKey: string): number => {
    const schema = this.getSchema(schemaKey);
    const properties = schema.properties;
    let count = 0;
    if (properties) {
      for (const key of Object.keys(properties)) {
        if (!isRef(properties[key])) {
          count += this.extractSchemaPathAsSchema(
            schemaKey,
            [`properties`, key],
            `${schemaKey}_${key}`,
          );
        }
      }
    }
    return count;
  };

  private readonly extractSchemasProperties = (): number => {
    let count = 0;
    for (const schemaKey of this.getSchemaKeys()) {
      count += this.extractSchemaProperties(schemaKey);
    }
    return count;
  };

  private readonly mergeSchema = (mergeSchemaKey: string): number => {
    const mergeSchemaPath = this.getSchemaPath(mergeSchemaKey);
    const mergeSchema = this.getSchema(mergeSchemaKey);
    let count = 0;
    for (const schemaKey of this.getSchemaKeys()) {
      if (schemaKey !== mergeSchemaKey) {
        mapDeep(this.getSchema(schemaKey), (value) => {
          if (deepEqual(value, mergeSchema)) {
            count++;
            return toRef({
              basePath: ``,
              path: mergeSchemaPath,
            });
          }
          return value;
        });
      }
    }
    return count;
  };

  private readonly mergeSchemas = (): number => {
    let count = 0;
    for (const mergeSchemaKey of this.getSchemaKeys()) {
      count += this.mergeSchema(mergeSchemaKey);
    }
    return count;
  };

  public readonly transform = (opts: TransformOptions = {}): void => {
    transform(
      () => this.rewriteSchemasAbsoluteRefs(),
      opts.rewriteSchemasAbsoluteRefs ?? `recursive`,
    );

    transform(
      () => this.extractSchemasProperties(),
      opts.extractSchemasProperties ?? `recursive`,
    );

    transform(() => this.mergeSchemas(), opts.mergeSchemas ?? `recursive`);

    if (opts.deleteUnusedSchemas !== false) {
      this.deleteUnusedSchemas();
    }
  };

  public readonly getSpec = (): Spec => this.spec;
}
