import { readFile, writeFile } from "fs/promises";
import { join } from "path";

import { SpecTransformer } from "../SpecTransformer";

test(`lisa`, async () => {
  const originalSpec = JSON.parse(
    await readFile(
      join(
        __dirname,
        `..`,
        `..`,
        `src`,
        `__tests__`,
        `lisa.openapi.original.fixtures.json`,
      ),
      {
        encoding: `utf-8`,
      },
    ),
  );
  const t = new SpecTransformer(originalSpec);

  const $ref = (key: string) =>
    ({
      $ref: `T#/properties/${key}`,
    } as const);

  const result = t.transform({
    mergeRefs: [
      $ref(`JsonRecord`),
      $ref(`Uuid`),
      $ref(`Email`),
      $ref(`UserEmail`),
      $ref(`GroupRole`),
      $ref(`ParticipantRole`),
      $ref(`ParticipantId`),
      $ref(`ParticipantGroupId`),
      $ref(`UserParticipantRelationship`),
    ],
    schemaKeys: {
      removeInitialSchemasPrefix: true,
      changeCase: `PascalCase`,
    },
  });

  await writeFile(
    join(
      __dirname,
      `..`,
      `..`,
      `src`,
      `__tests__`,
      `lisa.openapi.transformed.fixtures.json`,
    ),
    JSON.stringify(result, null, 2),
    { encoding: `utf-8` },
  );

  const transformedSpec = JSON.parse(
    await readFile(
      join(
        __dirname,
        `..`,
        `..`,
        `src`,
        `__tests__`,
        `lisa.openapi.transformed.fixtures.json`,
      ),
      { encoding: `utf-8` },
    ),
  );

  expect(result).toEqual(transformedSpec);
});
