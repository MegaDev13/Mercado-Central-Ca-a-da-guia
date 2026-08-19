import { loadConfig } from "./shared/config.ts";
import { Logger, defaultLogPath } from "./shared/logger.ts";
import { CloudServer } from "./cloud/CloudServer.ts";
import { createLocalStack } from "./app/createLocalStack.ts";

const config = loadConfig();
const log = new Logger(defaultLogPath(config.dataDir));
const cloud = new CloudServer(config, log);
cloud.start();

const stack = createLocalStack(config, log, cloud);
setTimeout(() => stack.gateway.start(), 250);
stack.executor.start(60);
stack.ui.start();

log.info("connection", `supervisor → http://127.0.0.1:${config.uiPort}`);
log.info("cloud", `planner ws → ${config.cloudWsUrl}`);
