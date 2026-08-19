import { loadConfig } from "./shared/config.ts";
import { Logger, defaultLogPath } from "./shared/logger.ts";
import { createLocalStack } from "./app/createLocalStack.ts";

const config = loadConfig();
const log = new Logger(defaultLogPath(config.dataDir));
const stack = createLocalStack(config, log);
stack.gateway.start();
stack.executor.start(80);
stack.ui.start();
log.info("connection", `supervisor → http://127.0.0.1:${config.uiPort}`);
