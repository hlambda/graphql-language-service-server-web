import {
  createConnection,
  BrowserMessageReader,
  BrowserMessageWriter,
} from "vscode-languageserver/browser";

import { Logger } from "./Logger";
import { addHandlers } from "./addHandlers";

console.log("Running server graphql-language-service-server-web");

/* browser specific setup code */

const messageReader = new BrowserMessageReader(self);
const messageWriter = new BrowserMessageWriter(self);

const connection = createConnection(messageReader, messageWriter);

/* from here on, all code is non-browser specific and could be shared with a regular extension */

const logger = new Logger(connection);

// Initialize Handlers (Ex async function initializeHandlers)
// Try to load handlers, we need to provide logger and connection
try {
  addHandlers({ connection, logger });
} catch (error) {
  logger.error("There was an error initializing the server connection");
  logger.error(String(error));
}

// Listen on the connection
connection.listen();
