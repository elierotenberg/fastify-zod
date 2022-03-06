import { z, ZodType } from "zod";

export type Models<Key extends string = string> = {
  readonly [K in Key]: ZodType<unknown>;
};

export type SchemaKey<M extends Models> = M extends Models<infer Key>
  ? Key & string
  : never;

export type SchemaKeyOrDescription<M extends Models> =
  | SchemaKey<M>
  | {
      readonly description: string;
      readonly key: SchemaKey<M>;
    };

type SchemaType<M extends Models, Key extends SchemaKey<M>> = z.infer<M[Key]>;

export type SchemaTypeOption<
  M extends Models,
  Key extends void | SchemaKey<M>,
> = Key extends SchemaKey<M> ? SchemaType<M, Key> : void;
