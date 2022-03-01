import {
  Configuration,
  DefaultApi,
  TodoItemStateEnum,
} from "fastify-zod-test-openapi-client";
import { tExpect } from "typed-jest-expect";

import { createTestServer } from "./fixtures";

test(`openapi-client`, async () => {
  const f = createTestServer();

  const basePath = await f.listen(0);

  try {
    const client = new DefaultApi(
      new Configuration({ basePath, fetchApi: require(`node-fetch`) }),
    );

    await tExpect(client.getTodoItems()).resolves.toEqual({ todoItems: [] });

    await tExpect(
      client.postTodoItem({
        todoItem: {
          id: `e7f7082a-4f16-430d-8c3b-db6b8d4d3e73`,
          label: `todo`,
          state: TodoItemStateEnum.Todo,
          dueDate: new Date(0),
        },
      }),
    ).resolves.toEqual({
      todoItems: [
        {
          id: `e7f7082a-4f16-430d-8c3b-db6b8d4d3e73`,
          label: `todo`,
          state: TodoItemStateEnum.Todo,
          dueDate: expect.any(Date),
        },
      ],
    });
  } finally {
    await f.close();
  }
});
