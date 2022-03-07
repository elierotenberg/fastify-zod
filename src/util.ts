import { ZodSchema, ZodType, z } from "zod";

export const isZod =
  <T>(Type: ZodType<T>) =>
  (input: unknown): input is T => {
    try {
      Type.parse(input);
      return true;
    } catch {
      return false;
    }
  };
export type ZodShape<T> = {
  // Require all the keys from T
  [key in keyof T]-?: undefined extends T[key]
    ? // When optional, require the type to be optional in zod
      z.ZodOptionalType<z.ZodType<T[key]>>
    : z.ZodType<T[key]>;
};

export const ZodShape = <T>(shape: ZodShape<T>): ZodSchema<T> =>
  z.object(shape).strict() as unknown as ZodSchema<T>;

export const isRecord = (input: unknown): input is Record<string, unknown> =>
  !Array.isArray(input) && typeof input === `object` && input !== null;

export const mapDeep = (
  current: unknown,
  replace: (value: unknown) => void,
): unknown => {
  if (Array.isArray(current)) {
    for (let k = 0; k < current.length; k++) {
      current[k] = replace(mapDeep(current[k], replace));
    }
  } else if (isRecord(current)) {
    for (const k of Object.keys(current)) {
      current[k] = replace(mapDeep(current[k], replace));
    }
  }
  return current;
};

export const findFirstDeep = (
  current: unknown,
  predicate: (value: unknown, path: string[]) => boolean,
  path: string[] = [],
): [found: boolean, value: unknown, path: string[]] => {
  if (predicate(current, path)) {
    return [true, current, path];
  }
  if (Array.isArray(current)) {
    for (let k = 0; k < current.length; k++) {
      path.push(`${k}`);
      const [found, value] = findFirstDeep(current[k], predicate, path);
      if (found) {
        return [found, value, path];
      }
      path.pop();
    }
    return [false, null, []];
  }
  if (isRecord(current)) {
    for (const k of Object.keys(current)) {
      path.push(k);
      const [found, value] = findFirstDeep(current[k], predicate, path);
      if (found) {
        return [found, value, path];
      }
      path.pop();
    }
    return [false, null, []];
  }
  return [false, null, []];
};

export const visitDeep = (
  current: unknown,
  visit: (value: unknown, path: string[]) => void,
  path: string[] = [],
): void => {
  visit(current, path);
  if (Array.isArray(current)) {
    for (let k = 0; k < current.length; k++) {
      path.push(`${k}`);
      visitDeep(current[k], visit, path);
      path.pop();
    }
    return;
  }
  if (isRecord(current)) {
    for (const k of Object.keys(current)) {
      path.push(k);
      visitDeep(current[k], visit, path);
      path.pop();
    }
    return;
  }
  return;
};
