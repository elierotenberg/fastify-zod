import { writeFile } from "fs/promises";
import { join } from "path";

import { createTestServer } from "./fixtures";

const main = async (): Promise<void> => {
  const f = createTestServer({ target: `jsonSchema7` });

  const spec = await f
    .inject({
      method: `get`,
      url: `/openapi/json`,
    })
    .then((res) => res.json());

  await writeFile(
    join(__dirname, `..`, `..`, `openapi.json`),
    JSON.stringify(spec, null, 2),
    {
      encoding: `utf-8`,
    },
  );
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
