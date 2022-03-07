import { buildJsonSchemas } from "../JsonSchema";

import { models } from "./models.fixtures";
import { createTestServer } from "./server.fixtures";

test(`FastifyZod`, async () => {
  const jsonSchemas = buildJsonSchemas(models, {});
  const f = createTestServer(
    {},
    {
      jsonSchemas,
      swaggerOptions: {
        transformSpec: {
          options: {
            mergeRefs: [jsonSchemas.$ref(`TodoState`)],
          },
        },
      },
    },
  );

  await expect(
    f
      .inject({
        method: `get`,
        url: `/item`,
      })
      .then((res) => res.json()),
  ).resolves.toEqual({ todoItems: [] });

  await expect(
    f
      .inject({
        method: `post`,
        url: `/item`,
        payload: {},
      })
      .then((res) => res.json()),
  ).resolves.toEqual({
    error: `Bad Request`,
    message: `body should have required property 'id'`,
    statusCode: 400,
  });

  await expect(
    f
      .inject({
        method: `post`,
        url: `/item`,
        payload: {
          id: 1337,
        },
      })
      .then((res) => res.json()),
  ).resolves.toEqual({
    error: `Bad Request`,
    message: `body.id should match format "uuid"`,
    statusCode: 400,
  });

  await expect(
    f
      .inject({
        method: `post`,
        url: `/item`,
        payload: {
          id: `e7f7082a-4f16-430d-8c3b-db6b8d4d3e73`,
          label: `todo`,
          state: `todo`,
          dueDateMs: new Date(1337).getTime(),
        },
      })
      .then((res) => res.json()),
  ).resolves.toEqual({
    todoItems: [
      {
        id: `e7f7082a-4f16-430d-8c3b-db6b8d4d3e73`,
        label: `todo`,
        state: `todo`,
        dueDateMs: new Date(1337).getTime(),
      },
    ],
  });

  await expect(
    f
      .inject({
        method: `put`,
        url: `/item/1337`,
      })
      .then((res) => res.json()),
  ).resolves.toEqual({
    error: `Bad Request`,
    message: `params.id should match format "uuid"`,
    statusCode: 400,
  });
});
