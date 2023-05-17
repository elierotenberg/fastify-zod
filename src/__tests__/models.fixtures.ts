import { z } from "zod";

const TodoItemId = z.object({
  id: z.string().uuid(`invalid todo item id`),
});
export type TodoItemId = z.infer<typeof TodoItemId>;

enum TodoStateEnum {
  Todo = `todo`,
  InProgress = `in progress`,
  Done = `done`,
}

const TodoState = z.nativeEnum(TodoStateEnum);

const TodoItem = TodoItemId.extend({
  label: z.string(),
  dueDateMs: z.number().int().nonnegative().optional(),
  state: TodoState,
});

export type TodoItem = z.infer<typeof TodoItem>;

const TodoItemNotFoundError = TodoItemId.extend({
  message: z.literal(`item not found`),
});

const TodoItems = z.object({
  todoItems: z.array(TodoItem),
});
export type TodoItems = z.infer<typeof TodoItems>;

const TodoItemsGroupedByStatus = z.object({
  todo: z.array(TodoItem),
  inProgress: z.array(TodoItem),
  done: z.array(TodoItem),
});

export type TodoItemsGroupedByStatus = z.infer<typeof TodoItemsGroupedByStatus>;

const FortyTwo = z.literal(42);
export type FortyTwo = z.infer<typeof FortyTwo>;

const Teapot = z.literal(`Oh, it's Teatime`);
export type Teapot = z.infer<typeof Teapot>;

export const models = {
  TodoState,
  TodoItemId,
  TodoItem,
  TodoItemNotFoundError,
  TodoItems,
  TodoItemsGroupedByStatus,
  FortyTwo,
  Teapot,
};
