import { buildJsonSchemas } from "../JsonSchema";

import { models } from "./models.fixtures";
import { createTestServer } from "./server.fixtures";

test(`FastifyZod`, async () => {
  const jsonSchemas = buildJsonSchemas(models, { errorMessages: true });
  const f = await createTestServer(
    {
      ajv: {
        customOptions: {
          allErrors: true,
        },
        plugins: [require(`ajv-errors`)],
      },
    },
    {
      jsonSchemas,
      transformSpec: {
        options: {
          mergeRefs: [jsonSchemas.$ref(`TodoState`)],
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
    code: `FST_ERR_VALIDATION`,
    error: `Bad Request`,
    message: `body must have required property 'id', body must have required property 'label', body must have required property 'state'`,
    statusCode: 400,
  });

  await expect(
    f
      .inject({
        method: `post`,
        url: `/item`,
        payload: {
          id: 1337,
          label: `todo`,
          state: `todo`,
        },
      })
      .then((res) => res.json()),
  ).resolves.toEqual({
    code: `FST_ERR_VALIDATION`,
    error: `Bad Request`,
    message: `body/id invalid todo item id`,
    statusCode: 400,
  });

  await expect(
    f
      .inject({
        method: `get`,
        url: `/item/e7f7082a-4f16-430d-8c3b-db6b8d4d3e73`,
      })
      .then(async (response) => ({
        statusCode: response.statusCode,
        body: await response.json(),
      })),
  ).resolves.toEqual({
    statusCode: 404,
    body: {
      id: `e7f7082a-4f16-430d-8c3b-db6b8d4d3e73`,
      message: `item not found`,
    },
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
        method: `get`,
        url: `/item/e7f7082a-4f16-430d-8c3b-db6b8d4d3e73`,
      })
      .then(async (response) => ({
        statusCode: response.statusCode,
        body: await response.json(),
      })),
  ).resolves.toEqual({
    statusCode: 200,
    body: {
      id: `e7f7082a-4f16-430d-8c3b-db6b8d4d3e73`,
      label: `todo`,
      state: `todo`,
      dueDateMs: new Date(1337).getTime(),
    },
  });

  await expect(
    f
      .inject({
        method: `put`,
        url: `/item/1337`,
      })
      .then((res) => res.json()),
  ).resolves.toEqual({
    code: `FST_ERR_VALIDATION`,
    error: `Bad Request`,
    message: `params/id invalid todo item id`,
    statusCode: 400,
  });
});
