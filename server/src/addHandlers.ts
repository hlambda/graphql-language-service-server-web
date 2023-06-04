import { Connection, TextDocuments } from "vscode-languageserver/browser";

import {
  CompletionRequest,
  CompletionResolveRequest,
  DefinitionRequest,
  DidOpenTextDocumentNotification,
  DidSaveTextDocumentNotification,
  DidChangeTextDocumentNotification,
  DidChangeConfigurationNotification,
  DidCloseTextDocumentNotification,
  ExitNotification,
  HoverRequest,
  InitializeRequest,
  PublishDiagnosticsNotification,
  DidChangeWatchedFilesNotification,
  ShutdownRequest,
  DocumentSymbolRequest,
  PublishDiagnosticsParams,
  WorkspaceSymbolRequest,
  createConnection,
} from "vscode-languageserver/browser";

import {
  InitializeParams,
  InitializeResult,
  ServerCapabilities,
} from "vscode-languageserver";

import { Logger } from "./Logger";
import {
  parseDocument,
  DEFAULT_SUPPORTED_EXTENSIONS,
  DEFAULT_SUPPORTED_GRAPHQL_EXTENSIONS,
} from "./parseDocument";

import { MessageProcessorWeb } from "./MessageProcessorWeb";

export type HandlerOptions = {
  connection: Connection;
  logger: Logger;
  config?: any; //GraphQLConfig;
  parser?: typeof parseDocument;
  fileExtensions?: string[];
  graphqlFileExtensions?: string[];
  tmpDir?: string;
  loadConfigOptions?: any; // LoadConfigOptions;
};

/**
 * take the resultant message connection, and attach the matching `MessageProcessor` instance event handlers
 * similar to languageFeatures.ts in monaco language modes
 *
 * @param options {HandlerOptions}
 */
export async function addHandlers({
  connection,
  logger,
  config,
  parser,
  fileExtensions,
  graphqlFileExtensions,
  tmpDir,
  loadConfigOptions,
}: HandlerOptions): Promise<void> {
  function reportDiagnostics(
    diagnostics: PublishDiagnosticsParams | null,
    connection: Connection
  ) {
    if (diagnostics) {
      void connection.sendNotification(
        PublishDiagnosticsNotification.type,
        diagnostics
      );
    }
  }

  const _parser = parseDocument;

  // Create new message processor
  const messageProcessor = new MessageProcessorWeb({
    connection,
    logger,
    config,
    parser: _parser,
    fileExtensions: fileExtensions || DEFAULT_SUPPORTED_EXTENSIONS,
    graphqlFileExtensions:
      graphqlFileExtensions || DEFAULT_SUPPORTED_GRAPHQL_EXTENSIONS,
    // loadConfigOptions,
  });

  // Debug
  messageProcessor.manualInit();
  // const rand = Math.round(Math.random() * 1000);
  // const timer = setInterval(() => {
  //   console.log(rand, messageProcessor._getTextDocuments());
  // }, 5000);

  connection.onNotification(
    DidOpenTextDocumentNotification.type,
    async (params) => {
      const diagnostics =
        await messageProcessor.handleDidOpenOrSaveNotification(params);
      reportDiagnostics(diagnostics, connection);
    }
  );
  connection.onNotification(
    DidSaveTextDocumentNotification.type,
    async (params) => {
      const diagnostics =
        await messageProcessor.handleDidOpenOrSaveNotification(params);
      reportDiagnostics(diagnostics, connection);
    }
  );
  connection.onNotification(
    DidChangeTextDocumentNotification.type,
    async (params) => {
      // Important event, any change to the content we track here in-inmem cache
      const diagnostics = await messageProcessor.handleDidChangeNotification(
        params
      );
      reportDiagnostics(diagnostics, connection);
    }
  );
  connection.onNotification(
    DidCloseTextDocumentNotification.type,
    async (params) => {
      const diagnostics = await messageProcessor.handleDidCloseNotification(
        params
      );
      reportDiagnostics(diagnostics, connection);
    }
  );
  connection.onRequest(ShutdownRequest.type, () =>
    messageProcessor.handleShutdownRequest()
  );
  connection.onNotification(ExitNotification.type, () =>
    messageProcessor.handleExitNotification()
  );

  connection.onRequest("$customGraphQL/Schema", async (params) => {
    const diagnosticsForAllFiles = await messageProcessor.setSchema(params);
    for (let i = 0; i < diagnosticsForAllFiles.length; i++) {
      const diagnostics = diagnosticsForAllFiles[i];
      reportDiagnostics(diagnostics, connection);
    }
  });

  // Ignore cancel requests
  connection.onNotification("$/cancelRequest", () => ({}));
  connection.onRequest(InitializeRequest.type, (params, token) =>
    messageProcessor.handleInitializeRequest(params, token)
  );
  connection.onRequest(CompletionRequest.type, (params) =>
    messageProcessor.handleCompletionRequest(params)
  );
  connection.onRequest(CompletionResolveRequest.type, (item) => item);
  connection.onRequest(DefinitionRequest.type, (params) =>
    messageProcessor.handleDefinitionRequest(params)
  );
  connection.onRequest(HoverRequest.type, (params) =>
    messageProcessor.handleHoverRequest(params)
  );
  connection.onNotification(DidChangeWatchedFilesNotification.type, (params) =>
    messageProcessor.handleWatchedFilesChangedNotification(params)
  );
  connection.onRequest(DocumentSymbolRequest.type, (params) =>
    messageProcessor.handleDocumentSymbolRequest(params)
  );
  connection.onRequest(WorkspaceSymbolRequest.type, (params) =>
    messageProcessor.handleWorkspaceSymbolRequest(params)
  );
  connection.onNotification(DidChangeConfigurationNotification.type, (params) =>
    messageProcessor.handleDidChangeConfiguration(params)
  );

  // connection.onInitialize((params: InitializeParams): InitializeResult => {
  // 	const capabilities: ServerCapabilities = {
  // 		// workspaceSymbolProvider: true,
  // 		// documentSymbolProvider: true,
  // 		// completionProvider: {
  // 		// 	resolveProvider: true,
  // 		// 	triggerCharacters: [' ', ':', '$', '(', '@'],
  // 		// },
  // 		// definitionProvider: true,
  // 		// textDocumentSync: 1,
  // 		// hoverProvider: true,
  // 		// workspace: {
  // 		// 	workspaceFolders: {
  // 		// 		supported: true,
  // 		// 		changeNotifications: true,
  // 		// 	},
  // 		// },
  // 		// debug
  // 		colorProvider: {}, // provide a color provider
  // 	};

  // 	return { capabilities };
  // });

  // WARNING THIS WILL DISABLE OTHER LISTENERS: https://github.com/microsoft/vscode-languageserver-node/issues/473
  // // Track open, change and close text document events
  // const documents = new TextDocuments(TextDocument);
  // documents.listen(connection);

  // // Register providers
  // connection.onDocumentColor((params) => {
  //   // getColorInformation(documents, params.textDocument)
  //   return null;
  // });
  // connection.onColorPresentation((params) => {
  //   //  getColorPresentation(params.color, params.range)
  //   return null;
  // });
}
