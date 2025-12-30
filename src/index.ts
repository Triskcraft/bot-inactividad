import { app } from "./api/server.js" // este carga el client y el cliente carga los servicios
import { envs } from "./config.js";
import { logger } from "./logger.js";

app.listen(envs.API_PORT, () => {
  logger.info(`api listening on port ${envs.API_PORT}`)
});