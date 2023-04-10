import { tExpect } from "typed-jest-expect";

import {
  Configuration,
  DefaultApi,
  SchemaTodoState,
} from "../../test-openapi-client";
import { buildJsonSchemas } from "..";

import { models } from "./models.fixtures";
import {
  createTestServer,
  openApiOptions,
  swaggerUiOptions,
} from "./server.fixtures";

test(`openapi-client`, async () => {
  const f = await createTestServer(
    {},
    {
      jsonSchemas: buildJsonSchemas(models, {}),
      transformSpec: {},
      swaggerOptions: {
        ...openApiOptions,
      },
      swaggerUiOptions,
    },
  );

  const basePath = await f.listen({ port: 0 });

  try {
    const client = new DefaultApi(
      new Configuration({ basePath, fetchApi: global.fetch }),
    );

    await tExpect(client.getTodoItems()).resolves.toEqual({ todoItems: [] });

    await tExpect(
      client.postTodoItem({
        schemaTodoItem: {
          id: `e7f7082a-4f16-430d-8c3b-db6b8d4d3e73`,
          label: `todo`,
          state: SchemaTodoState.Todo,
          dueDateMs: new Date(1337).getTime(),
        },
      }),
    ).resolves.toEqual({
      todoItems: [
        {
          id: `e7f7082a-4f16-430d-8c3b-db6b8d4d3e73`,
          label: `todo`,
          state: SchemaTodoState.Todo,
          dueDateMs: new Date(1337).getTime(),
        },
      ],
    });
  } finally {
    await f.close();
  }
});
