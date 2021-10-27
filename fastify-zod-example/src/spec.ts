import { createServer } from "./server";

const server = createServer();

server
  .inject({
    method: `get`,
    url: `/openapi/yaml`,
  })
  .then((res) => console.log(res.body));
