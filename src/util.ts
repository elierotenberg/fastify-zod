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

export const isRecord = isZod(z.record(z.unknown()));

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

export const visitDeep = (
  current: unknown,
  visit: (value: unknown, path: string[]) => boolean,
  path: string[] = [],
): void => {
  if (!visit(current, path)) {
    return;
  }
  if (Array.isArray(current)) {
    for (let k = 0; k < current.length; k++) {
      path.push(`${k}`);
      visitDeep(current[k], visit, path);
      path.pop();
    }
  } else if (isRecord(current)) {
    for (const k of Object.keys(current)) {
      path.push(k);
      visitDeep(current[k], visit, path);
      path.pop();
    }
  }
};
