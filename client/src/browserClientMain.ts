/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from "vscode";
import { ExtensionContext, Uri } from "vscode";
import { LanguageClientOptions } from "vscode-languageclient";

import { LanguageClient } from "vscode-languageclient/browser";

import loadGraphQLProjectConfigs from "./loadGraphQLProjectConfigs";
import fetchRemoteGraphQLSchema from "./fetchRemoteGraphQLSchema";
import getWorkspaceGraphQLSchema from "./getWorkspaceGraphQLSchema";
import setupExecuteGraphQLFunctionality from "./exec/setupExecuteGraphQLFunctionality";
import store from "./store";

// this method is called when vs code is activated
export async function activate(context: ExtensionContext) {
  console.log("graphql-language-service-server-web activated!");

  /*
   * all except the code to create the language client in not browser specific
   * and could be shared with a regular (Node) extension
   */
  const documentSelector = [
    // { language: "plaintext" }, // Should we try to figure out the graphql like text in plaintext ? What about markdown ?
    // { language: "markdown" }, // Look the question above :)
    { language: "javascript" },
    { language: "graphql" },
    { language: "typescript" },
  ];

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    documentSelector,
    synchronize: {},
    initializationOptions: {},
  };

  const client = createWorkerLanguageClient(context, clientOptions);

  const disposable = client.start();
  context.subscriptions.push(disposable);

  client.onReady().then(() => {
    console.log("graphql-language-service-server-web server is ready");
  });

  // Add command to load project config. (Command used to start everything)
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "graphql-language-service-server-web.load-configs",
      async (isFirstStartup = false) => {
        return await loadGraphQLProjectConfigs(isFirstStartup);
      }
    )
  );

  // Add command to fetch remote configs
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "graphql-language-service-server-web.fetch-remote-graphql-schema-from-selected-project",
      async () => {
        return await fetchRemoteGraphQLSchema();
      }
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "graphql-language-service-server-web.fetch-workspace-graphql-schema-from-selected-project",
      async () => {
        return getWorkspaceGraphQLSchema();
      }
    )
  );

  // This commands is used to create offline graphql schema backup.
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "graphql-language-service-server-web.fetch-remote-graphql-schema-from-selected-project-save-offline-backup",
      async () => {
        const result = await fetchRemoteGraphQLSchema();
        const doc = await vscode.workspace.openTextDocument({
          language: "json",
          content: JSON.stringify(result.responseSchemaJSON, null, 2),
        });
        vscode.window.showTextDocument(doc);
        return;
      }
    )
  );

  // Send update schema request to LSP.
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "graphql-language-service-server-web.lsp-schema-update-request",
      async () => {
        // Send to the server new schema in JSON representation (from API)
        const { responseSchemaJSON, selectedProject } = store;
        if (!responseSchemaJSON) {
          vscode.window.showInformationMessage(
            `Missing schema, please configure the projects.`
          );
          return;
        }
        if (!selectedProject) {
          vscode.window.showInformationMessage(`No project is selected.`);
          return;
        }

        const reduceFilesToRefreshDiagnostics =
          vscode.workspace.textDocuments.reduce((acc, textDocument) => {
            acc.push({
              uri: textDocument.uri.toString(),
              text: textDocument.getText(),
            });
            return acc;
          }, []);

        client.sendRequest("$customGraphQL/Schema", {
          responseSchemaJSON,
          project: selectedProject,
          textDocuments: JSON.parse(
            JSON.stringify(reduceFilesToRefreshDiagnostics)
          ),
        });
        return true;
      }
    )
  );

  // Try to load configs without any user interaction. (In cases where you have 1 workspace and 1 project, or at least 1 default project and schema is downloaded)
  // Start!
  await vscode.commands.executeCommand(
    "graphql-language-service-server-web.load-configs",
    true // It is a first startup initiated by the extension.
  );
  // --------------------------------------------------------------------------------
  // Add ability to execute queries.
  await setupExecuteGraphQLFunctionality(context);
}

function createWorkerLanguageClient(
  context: ExtensionContext,
  clientOptions: LanguageClientOptions
) {
  // Create a worker. The worker main file implements the language server.
  const serverMain = Uri.joinPath(
    context.extensionUri,
    "server/dist/browserServerMain.js"
  );
  const worker = new Worker(serverMain.toString(true));

  // create the language server client to communicate with the server running in the worker
  return new LanguageClient(
    "graphql-language-service-server-web",
    "GraphQL Hlambda LSP Web Extension",
    clientOptions,
    worker
  );
}
