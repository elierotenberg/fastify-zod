import { isRecord } from "./util";

export const stringifyPath = (path: string[]): string => path.join(`/`);

export const equalPath = (a: string[], b: string[]): boolean => {
  if (a.length !== b.length) {
    return false;
  }
  for (let k = 0; k < a.length; k++) {
    if (a[k] !== b[k]) {
      return false;
    }
  }
  return true;
};

const getParentPath = <T extends string>(path: T[]): T[] => {
  if (path.length === 0) {
    throw new Error(`path='${stringifyPath(path)}' has no parent`);
  }
  return path.slice(0, -1);
};

export const getChildPath = <T extends string>(
  path: T[],
  ...childPath: T[]
): T[] => [...path, ...childPath];

const getPathLastSegment = <T extends string>(path: T[]): T => {
  if (path.length === 0) {
    throw new Error(`path='${stringifyPath}' has no parent`);
  }
  return path[path.length - 1];
};

const getChildSafe = (
  current: unknown,
  segment: string,
): [childFound: boolean, value: unknown] => {
  if (Array.isArray(current)) {
    const index = parseInt(segment);
    if (!Number.isInteger(index)) {
      throw new Error(
        `current is an array but segment='${segment}' is not an integer`,
      );
    }
    if (index < 0) {
      throw new Error(`current is an array but index='${index}' is negative`);
    }
    return [typeof current[index] !== undefined, current[index]];
  }
  if (isRecord(current)) {
    return [Object.keys(current).includes(segment), current[segment]];
  }
  return [false, undefined];
};

export const getAtPathSafe = (
  obj: unknown,
  path: string[],
): [valueFound: boolean, value: unknown] => {
  let current = obj;

  for (let k = 0; k < path.length; k++) {
    const [childFound, child] = getChildSafe(current, path[k]);
    if (!childFound) {
      if (k !== path.length - 1) {
        throw new Error(
          `parent(path='${stringifyPath(path)}') has no child at segment='${
            path[k]
          }'`,
        );
      }
      return [false, undefined];
    }
    current = child;
  }
  return [true, current];
};

export const getAtPath = (obj: unknown, path: string[]): unknown => {
  const [found, value] = getAtPathSafe(obj, path);
  if (!found) {
    throw new Error(`value(path='${stringifyPath(path)}') not found`);
  }
  return value;
};

export const setAtPath = (
  obj: unknown,
  path: string[],
  value: unknown,
): void => {
  const [parentFound, parent] = getAtPathSafe(obj, getParentPath(path));
  if (!parentFound) {
    throw new Error(`parent(path='${stringifyPath(path)}') not found`);
  }
  const key = getPathLastSegment(path);

  if (Array.isArray(parent)) {
    const index = parseInt(key);
    if (!Number.isInteger(index)) {
      throw new Error(
        `key(path='${stringifyPath(path)}', key='${key}') is not an integer`,
      );
    }
    if (index < 0) {
      throw new Error(
        `index(path='${stringifyPath(path)}', index='${index}') is negative`,
      );
    }
    if (index > parent.length) {
      throw new Error(
        `index(path='${stringifyPath(
          path,
        )}', index='${index}') is out of bounds`,
      );
    }
    if (index === parent.length) {
      parent.push(value);
    } else {
      parent[index] = value;
    }
  } else if (isRecord(parent)) {
    parent[key] = value;
  } else {
    throw new Error(`parent(path='${path}') is not an Array or a Record`);
  }
};

export const deleteAtPath = (obj: unknown, path: string[]): void => {
  const [parentFound, parent] = getAtPathSafe(obj, getParentPath(path));
  if (!parentFound) {
    throw new Error(`parent(path='${stringifyPath(path)}') not found`);
  }
  const key = getPathLastSegment(path);

  if (Array.isArray(parent)) {
    const index = parseInt(key);
    if (!Number.isInteger(index)) {
      throw new Error(
        `key(path='${stringifyPath(path)}', key='${key}') is not an integer`,
      );
    }
    if (index !== parent.length) {
      throw new Error(
        `index(path='${stringifyPath(
          path,
        )}', index='${index}') is invalid: only last item of parent array can be deleted`,
      );
    }
    parent.pop();
  } else if (isRecord(parent)) {
    if (!Object.keys(parent).includes(key)) {
      throw new Error(
        `key(path='${stringifyPath(path)}', key='${key}') not found in parent`,
      );
    }
    delete parent[key];
  } else {
    throw new Error(
      `parent(path='${stringifyPath(path)}') is not an Array or a Record`,
    );
  }
};

export const matchPathPrefix = (
  prefixPath: readonly string[],
  path: string[],
): boolean => {
  if (path.length < prefixPath.length) {
    return false;
  }
  for (let k = 0; k < prefixPath.length; k++) {
    if (path[k] !== prefixPath[k]) {
      return false;
    }
  }
  return true;
};

export const replacePathPrefix = <T extends string>(
  prevPrefixPath: T[],
  nextPrefixPath: T[],
  path: T[],
): T[] => {
  if (!matchPathPrefix(prevPrefixPath, path)) {
    throw new Error(
      `path='${stringifyPath(
        path,
      )}' doesn't match prevPrefixPath='${stringifyPath(prevPrefixPath)}'`,
    );
  }
  return [...nextPrefixPath, ...path.slice(prevPrefixPath.length)];
};
