import { inspect } from "util";

import { camelCase, pascalCase, snakeCase, paramCase } from "change-case";
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
import { findFirstDeep, isRecord, visitDeep } from "./util";

type Ref = {
  $ref: string;
};

const isRef = (ref: unknown): ref is Ref => {
  if (!isRecord(ref)) {
    return false;
  }
  return typeof ref.$ref === `string`;
};

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

type SpecSchema = {
  readonly properties?: Record<string, unknown>;
  readonly additionalProperties?: boolean | Record<string, unknown>;
  readonly patternProperties?: Record<string, unknown>;
  readonly items?: Record<string, unknown>;
};

const isSpecSchema = (input: unknown): input is SpecSchema => {
  if (!isRecord(input)) {
    return false;
  }
  const { properties, additionalProperties, patternProperties, items } = input;
  if (typeof properties !== `undefined` && !isRecord(properties)) {
    return false;
  }

  if (
    typeof additionalProperties !== `undefined` &&
    typeof additionalProperties !== `boolean` &&
    !isRecord(additionalProperties)
  ) {
    return false;
  }

  if (
    typeof patternProperties !== `undefined` &&
    typeof patternProperties !== `boolean` &&
    !isRecord(patternProperties)
  ) {
    return false;
  }

  if (typeof items !== `undefined` && !isRecord(items)) {
    return false;
  }

  return true;
};

type SpecSchemas = Record<string, SpecSchema>;

const isSpecSchemas = (input: unknown): input is SpecSchemas => {
  if (!isRecord(input)) {
    return false;
  }
  for (const value of Object.values(input)) {
    if (!isSpecSchema(value)) {
      return false;
    }
  }
  return true;
};

type OpenApiSpec = {
  readonly components: {
    readonly schemas: SpecSchemas;
  };
  readonly paths?: Record<string, unknown>;
};

const isOpenApiSpec = (input: unknown): input is OpenApiSpec => {
  if (!isRecord(input)) {
    return false;
  }
  const { components, paths } = input;
  if (!isRecord(components)) {
    return false;
  }
  const { schemas } = components;
  if (!isSpecSchemas(schemas)) {
    return false;
  }
  if (typeof paths !== `undefined` && !isRecord(paths)) {
    return false;
  }
  return true;
};

type SwaggerSpec = {
  readonly definitions: SpecSchemas;
  readonly paths?: Record<string, unknown>;
};

const isSwaggerSpec = (input: unknown): input is SwaggerSpec => {
  if (!isRecord(input)) {
    return false;
  }
  const { definitions, paths } = input;
  if (!isSpecSchemas(definitions)) {
    return false;
  }
  if (typeof paths !== `undefined` && !isRecord(paths)) {
    return false;
  }
  return true;
};

export type Spec = OpenApiSpec | SwaggerSpec;

const isSpec = (input: unknown): input is Spec =>
  isOpenApiSpec(input) || isSwaggerSpec(input);

const deepClone = (spec: Spec): Spec => JSON.parse(JSON.stringify(spec));

type ExtractSchemaPropertiesKey =
  | `properties`
  | `additionalProperties`
  | `patternProperties`
  | `items`;

const defaultExtractSchemaPropertiesKey: ExtractSchemaPropertiesKey[] = [
  `properties`,
  `additionalProperties`,
  `patternProperties`,
  `items`,
];

type Timings = {
  readonly begin: number;
  readonly end: number;
  readonly delta: number;
};

const withTimings = <T>(fn: () => T): [result: T, timings: Timings] => {
  const begin = performance.now();
  const result = fn();
  const end = performance.now();

  return [
    result,
    {
      begin,
      end,
      delta: end - begin,
    },
  ];
};

type TransformWithTimingsResult = {
  readonly spec: Spec;
  readonly timings: {
    readonly rewriteSchemasAbsoluteRefs: Timings;
    readonly extractSchemasProperties: Timings;
    readonly mergeRefs: Timings;
    readonly deleteUnusedSchemas: Timings;
    readonly total: Timings;
  };
};

type SchemaKeysOptions = {
  readonly removeInitialSchemasPrefix?: boolean;
  readonly changeCase?:
    | `preserve`
    | `camelCase`
    | `PascalCase`
    | `snake_case`
    | `param-case`;
};

export type TransformOptions = {
  readonly rewriteSchemasAbsoluteRefs?: boolean;
  readonly extractSchemasProperties?: boolean | ExtractSchemaPropertiesKey[];
  readonly mergeRefs?: Ref[];
  readonly deleteUnusedSchemas?: boolean;
  readonly schemaKeys?: SchemaKeysOptions;
};

export class SpecTransformer {
  private readonly DEBUG: boolean;
  private readonly spec: Spec;
  private readonly initialSchemaKeys: string[];

  private readonly schemasPath: string[];

  public constructor(spec: unknown, DEBUG = false) {
    if (!isSpec(spec)) {
      throw new Error(`spec is not an OpenApiSpec or a SwaggerSpec`);
    }
    this.spec = deepClone(spec);
    this.schemasPath = isOpenApiSpec(spec)
      ? [`components`, `schemas`]
      : [`definitions`];
    this.initialSchemaKeys = this.getSchemaKeys();
    this.DEBUG = DEBUG;
  }

  private readonly _DEBUG = (...args: unknown[]): void => {
    if (this.DEBUG) {
      console.debug(...args);
    }
  };

  private readonly throw = (error: unknown): never => {
    if (this.DEBUG) {
      console.debug(inspect(this.spec, { depth: null }));
      console.error(error);
    }
    throw error;
  };

  private readonly getSchemaPath = (schemaKey: string): string[] =>
    getChildPath(getChildPath(this.schemasPath, schemaKey));

  private readonly getSchema = (schemaKey: string): SpecSchema => {
    const schema = this.getAtPath(this.getSchemaPath(schemaKey));
    if (!isSpecSchema(schema)) {
      return this.throw(new Error(`schema is not a SpecSchema`));
    }
    return schema;
  };

  private readonly getSchemaKeys = (): string[] => {
    const schemas = this.getAtPath(this.schemasPath);
    if (!isRecord(schemas)) {
      return this.throw(new Error(`schemas is not a Record`));
    }
    return Object.keys(schemas);
  };

  private readonly createSchemaKey = (
    parentSchemaKey: string,
    path: string[],
    schemaKeysOptions?: SchemaKeysOptions,
  ): string => {
    const parts: string[] = [];
    if (
      !schemaKeysOptions?.removeInitialSchemasPrefix ||
      !this.initialSchemaKeys.includes(parentSchemaKey)
    ) {
      parts.push(parentSchemaKey);
    }
    parts.push(...path);
    const baseName = parts.join(`_`);
    const schemaKey =
      schemaKeysOptions?.changeCase === `PascalCase`
        ? pascalCase(baseName)
        : schemaKeysOptions?.changeCase === `camelCase`
        ? camelCase(baseName)
        : schemaKeysOptions?.changeCase === `param-case`
        ? paramCase(baseName)
        : schemaKeysOptions?.changeCase === `snake_case`
        ? snakeCase(baseName)
        : baseName;
    if (this.getSchemaKeys().includes(schemaKey)) {
      throw new Error(`schemaKey(schemaKey='${schemaKey}') already exists`);
    }
    return schemaKey;
  };

  private readonly getAtPath = (path: string[]): unknown =>
    getAtPath(this.spec, path);

  private readonly getAtPathSafe = (
    path: string[],
  ): [valueFound: boolean, value: unknown] => getAtPathSafe(this.spec, path);

  private readonly resolveRef = (
    $ref: string,
  ): [value: unknown, $ref: string] => {
    const refPath = toRefPath($ref);
    if (refPath.basePath.length > 0) {
      const nextRef = toRef({
        basePath: ``,
        path: getChildPath(
          this.getSchemaPath(refPath.basePath),
          ...refPath.path,
        ),
      });
      return this.resolveRef(nextRef.$ref);
    }
    const value = this.getAtPath(refPath.path);
    if (isRef(value)) {
      return this.resolveRef(value.$ref);
    }
    return [value, $ref];
  };

  private readonly setAtPath = (path: string[], value: unknown): void => {
    this._DEBUG(`setAtPath`, { path, value });
    return setAtPath(this.spec, path, value);
  };

  private readonly deleteAtPath = (path: string[]): void => {
    this._DEBUG(`deleteAtPath`, { path });
    return deleteAtPath(this.spec, path);
  };

  private readonly findFirstDeep = (
    predicate: (value: unknown, path: string[]) => boolean,
  ): [found: boolean, value: unknown, path: string[]] =>
    findFirstDeep(this.spec, predicate);

  private readonly hasProperRef = (schemaKey: string): boolean => {
    const schemaPath = this.getSchemaPath(schemaKey);
    const [hasProperRef] = this.findFirstDeep((value, path) => {
      if (equalPath(path, schemaPath)) {
        return false;
      }
      if (isRef(value)) {
        const refPath = toRefPath(value.$ref);
        return (
          refPath.basePath.length === 0 &&
          matchPathPrefix(schemaPath, refPath.path)
        );
      }
      return false;
    });
    return hasProperRef;
  };

  private readonly deleteUnusedSchemas = (): void => {
    this._DEBUG(`deleteUnusedSchemas`);
    let dirty = true;
    while (dirty) {
      dirty = false;
      for (const schemaKey of this.getSchemaKeys()) {
        if (!this.hasProperRef(schemaKey)) {
          this.deleteAtPath(this.getSchemaPath(schemaKey));
          dirty = true;
          break;
        }
      }
    }
  };

  private readonly rewriteSchemaAbsoluteRefs = (schemaKey: string): boolean => {
    const schema = this.getSchema(schemaKey);
    const schemaPath = this.getSchemaPath(schemaKey);
    let dirty = false;
    visitDeep(schema, (value) => {
      if (isRef(value)) {
        const refPath = toRefPath(value.$ref);
        if (
          refPath.basePath.length === 0 &&
          !matchPathPrefix(schemaPath, refPath.path)
        ) {
          const nextPath = getChildPath(schemaPath, ...refPath.path);
          value.$ref = toRef({ basePath: ``, path: nextPath }).$ref;
          dirty = true;
        }
      }
    });
    return dirty;
  };

  private readonly rewriteSchemasAbsoluteRefs = (): void => {
    this._DEBUG(`rewriteSchemasAbsoluteRefs`);
    let dirty = true;
    while (dirty) {
      dirty = false;
      for (const schemaKey of this.getSchemaKeys()) {
        if (this.rewriteSchemaAbsoluteRefs(schemaKey)) {
          dirty = true;
          break;
        }
      }
    }
  };

  private readonly extractSchemaPathAsSchema = (
    prevSchemaKey: string,
    prevRelativePath: string[],
    nextSchemaKey: string,
  ): boolean => {
    const prevPath = getChildPath(
      this.getSchemaPath(prevSchemaKey),
      ...prevRelativePath,
    );

    const prevValue = this.getAtPath(prevPath);
    const nextPath = this.getSchemaPath(nextSchemaKey);

    const [hasValueAtNextPath, valueAtNextPath] = this.getAtPathSafe(nextPath);

    if (hasValueAtNextPath) {
      if (!deepEqual(prevValue, valueAtNextPath)) {
        this.throw(
          new Error(
            `schema(schemaKey='${nextSchemaKey}') already exists with a different value`,
          ),
        );
      }
    } else {
      this.setAtPath(nextPath, prevValue);
    }

    this.setAtPath(prevPath, toRef({ basePath: ``, path: nextPath }));

    let dirty = false;
    visitDeep(this.spec, (value) => {
      if (isRef(value)) {
        const refPath = toRefPath(value.$ref);
        if (
          refPath.basePath.length === 0 &&
          matchPathPrefix(prevPath, refPath.path)
        ) {
          value.$ref = toRef({
            basePath: ``,
            path: replacePathPrefix(prevPath, nextPath, refPath.path),
          }).$ref;
          dirty = true;
        }
      }
    });
    return dirty;
  };

  private readonly extractSchemaPropertiesAtKey = (
    parentSchemaKey: string,
    propertiesKey: ExtractSchemaPropertiesKey,
    schemaKeysOptions?: SchemaKeysOptions,
  ): boolean => {
    let globalDirty = false;
    let dirty = true;
    while (dirty) {
      dirty = false;
      if (
        propertiesKey === `properties` ||
        propertiesKey === `additionalProperties` ||
        propertiesKey === `patternProperties`
      ) {
        const properties = this.getSchema(parentSchemaKey)[propertiesKey];
        if (isRecord(properties)) {
          for (const k of Object.keys(properties)) {
            const property = properties[k];
            if (!isRef(property)) {
              const nextSchemaKey = this.createSchemaKey(
                parentSchemaKey,
                [`${k}`],
                schemaKeysOptions,
              );
              this.extractSchemaPathAsSchema(
                parentSchemaKey,
                [propertiesKey, k],
                nextSchemaKey,
              );
              dirty = true;
              break;
            }
          }
        }
      }
      if (propertiesKey === `items`) {
        const properties = this.getSchema(parentSchemaKey)[propertiesKey];
        if (isRecord(properties) && !isRef(properties)) {
          const nextSchemaKey = this.createSchemaKey(
            parentSchemaKey,
            [`item`],
            schemaKeysOptions,
          );
          this.extractSchemaPathAsSchema(
            parentSchemaKey,
            [`items`],
            nextSchemaKey,
          );
          dirty = true;
        }
      }
      if (dirty) {
        globalDirty = true;
      }
    }
    return globalDirty;
  };

  private readonly extractSchemaProperties = (
    schemaKey: string,
    propertiesKeys: ExtractSchemaPropertiesKey[],
    schemaKeysOptions?: SchemaKeysOptions,
  ): boolean => {
    let globalDirty = false;
    let dirty = true;
    while (dirty) {
      dirty = false;
      for (const propertiesKey of propertiesKeys) {
        if (
          this.extractSchemaPropertiesAtKey(
            schemaKey,
            propertiesKey,
            schemaKeysOptions,
          )
        ) {
          dirty = true;
        }
      }
      if (dirty) {
        globalDirty = true;
      }
    }
    for (const propertiesKey of propertiesKeys) {
      if (
        this.extractSchemaPropertiesAtKey(
          schemaKey,
          propertiesKey,
          schemaKeysOptions,
        )
      ) {
        this.extractSchemaProperties(
          schemaKey,
          propertiesKeys,
          schemaKeysOptions,
        );
        return true;
      }
    }
    return globalDirty;
  };

  private readonly extractSchemasProperties = (
    propertiesKeys: ExtractSchemaPropertiesKey[],
    schemaKeysOptions?: SchemaKeysOptions,
  ): void => {
    this._DEBUG(`extractSchemasProperties`);
    let dirty = true;
    while (dirty) {
      dirty = false;
      for (const schemaKey of this.getSchemaKeys()) {
        if (
          this.extractSchemaProperties(
            schemaKey,
            propertiesKeys,
            schemaKeysOptions,
          )
        ) {
          dirty = true;
          break;
        }
      }
    }
  };

  private readonly mergeRef = (prev$ref: string): boolean => {
    const [schema, next$ref] = this.resolveRef(prev$ref);
    let globalDirty = false;
    let dirty = true;
    while (dirty) {
      dirty = false;
      visitDeep(this.spec, (value, path) => {
        if (value !== schema && deepEqual(value, schema)) {
          this.setAtPath(path, {
            $ref: next$ref,
          });
          dirty = true;
        }
      });
      if (dirty) {
        globalDirty = true;
      }
    }
    return globalDirty;
  };

  private readonly mergeRefs = ($refs: string[]): void => {
    let dirty = true;
    while (dirty) {
      dirty = false;
      for (const $ref of $refs) {
        if (this.mergeRef($ref)) {
          dirty = true;
          break;
        }
      }
    }
  };

  public readonly transformWithTimings = (
    opts: TransformOptions = {},
  ): TransformWithTimingsResult => {
    const [
      {
        rewriteSchemasAbsoluteRefs,
        extractSchemasProperties,
        mergeRefs,
        deleteUnusedSchemas,
      },
      total,
    ] = withTimings(() => {
      const [, rewriteSchemasAbsoluteRefs] = withTimings(() => {
        if (opts.rewriteSchemasAbsoluteRefs === false) {
          return;
        }
        this.rewriteSchemasAbsoluteRefs();
      });

      const [, mergeRefs] = withTimings(() => {
        if (opts.mergeRefs) {
          this.mergeRefs(opts.mergeRefs.map((ref) => ref.$ref));
        }
      });

      this._DEBUG({ mergeRefs });

      this._DEBUG({ rewriteSchemasAbsoluteRefs });

      const [, extractSchemasProperties] = withTimings(() => {
        if (opts.extractSchemasProperties === false) {
          return;
        }
        const extractSchemasPropertiesKeys = !Array.isArray(
          opts.extractSchemasProperties,
        )
          ? defaultExtractSchemaPropertiesKey
          : opts.extractSchemasProperties;
        this.extractSchemasProperties(
          extractSchemasPropertiesKeys,
          opts.schemaKeys,
        );
      });

      this._DEBUG({ extractSchemasProperties });

      const [, deleteUnusedSchemas] = withTimings(() => {
        if (opts.deleteUnusedSchemas === false) {
          return;
        }
        this.deleteUnusedSchemas();
      });

      this._DEBUG({ deleteUnusedSchemas });

      return {
        rewriteSchemasAbsoluteRefs,
        extractSchemasProperties,
        mergeRefs,
        deleteUnusedSchemas,
      };
    });

    this._DEBUG({ total });

    return {
      spec: this.spec,
      timings: {
        rewriteSchemasAbsoluteRefs,
        extractSchemasProperties,
        mergeRefs,
        deleteUnusedSchemas,
        total,
      },
    };
  };

  public readonly transform = (opts: TransformOptions = {}): Spec =>
    this.transformWithTimings(opts).spec;
}
