import { writeFile } from "fs/promises";
import { join } from "path";

import { buildJsonSchemas } from "..";

import { models } from "./models.fixtures";
import { createTestServer, openApiOptions } from "./server.fixtures";

const main = async (): Promise<void> => {
  const f = createTestServer(
    {},
    {
      jsonSchemas: buildJsonSchemas(models, {}),
      swaggerOptions: {
        ...openApiOptions,
        transformSpec: { options: {} },
      },
    },
  );

  const originalSpec = await f
    .inject({
      method: `get`,
      url: `/documentation/json`,
    })
    .then((res) => res.json());

  await writeFile(
    join(__dirname, `..`, `..`, `openapi.original.json`),
    JSON.stringify(originalSpec, null, 2),
    { encoding: `utf-8` },
  );

  const transformedSpecJson = await f
    .inject({
      method: `get`,
      url: `/documentation_transformed/json`,
    })
    .then((res) => res.body);

  await writeFile(
    join(__dirname, `..`, `..`, `openapi.transformed.json`),
    transformedSpecJson,
    { encoding: `utf-8` },
  );

  const transformedSpecYaml = await f
    .inject({
      method: `get`,
      url: `/documentation_transformed/yaml`,
    })
    .then((res) => res.body);

  await writeFile(
    join(__dirname, `..`, `..`, `openapi.transformed.yml`),
    transformedSpecYaml,
    { encoding: `utf-8` },
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
