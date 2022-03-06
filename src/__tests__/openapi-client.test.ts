import {
  Configuration,
  DefaultApi,
  SchemaTodoItemState,
} from "fastify-zod-test-openapi-client";
import { tExpect } from "typed-jest-expect";

import { buildJsonSchemas } from "..";

import { models } from "./models.fixtures";
import { createTestServer, openApiOptions } from "./server.fixtures";

test(`openapi-client`, async () => {
  const f = createTestServer(
    {},
    {
      jsonSchemas: buildJsonSchemas(models, {}),
      swaggerOptions: {
        ...openApiOptions,
        transformSpec: {},
      },
    },
  );

  const basePath = await f.listen(0);

  try {
    const client = new DefaultApi(
      new Configuration({ basePath, fetchApi: require(`node-fetch`) }),
    );

    await tExpect(client.getTodoItems()).resolves.toEqual({ todoItems: [] });

    await tExpect(
      client.postTodoItem({
        schemaTodoItem: {
          id: `e7f7082a-4f16-430d-8c3b-db6b8d4d3e73`,
          label: `todo`,
          state: SchemaTodoItemState.Todo,
          dueDateMs: new Date(1337).getTime(),
        },
      }),
    ).resolves.toEqual({
      todoItems: [
        {
          id: `e7f7082a-4f16-430d-8c3b-db6b8d4d3e73`,
          label: `todo`,
          state: SchemaTodoItemState.Todo,
          dueDateMs: new Date(1337).getTime(),
        },
      ],
    });
  } finally {
    await f.close();
  }
});
