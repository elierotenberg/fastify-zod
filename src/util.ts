import { ZodType } from "zod";

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
