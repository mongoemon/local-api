import { createApp } from "./app.js";
import { config } from "./config.js";

const app = createApp(config);

app.listen(config.server.port, () => {
  console.log(`API running at http://localhost:${config.server.port}`);
  console.log("Active config:");
  console.log(JSON.stringify(config, null, 2));
});
