/*
	This function sets the execute GraphQL functionality for the extension.
*/

import * as vscode from "vscode";

import { visit, OperationTypeNode } from "graphql";

import { GraphQLContentProvider } from "./providers/exec-content";
import { GraphQLCodeLensProvider } from "./providers/exec-codelens";
import { ExtractedTemplateLiteral } from "./helpers/source";
import getConfig from "./getConfig";
import store from "./../store";

export const setupExecuteGraphQLFunctionality = async (
  context: vscode.ExtensionContext
): Promise<void> => {
  const outputChannel: vscode.OutputChannel = vscode.window.createOutputChannel(
    "GraphQL Operation Execution"
  );

  const config = getConfig();
  const { debug } = config;

  if (debug) {
    console.log('Extension "vscode-graphql" is now active!');
  }

  const commandShowOutputChannel = vscode.commands.registerCommand(
    "vscode-graphql-execution.showOutputChannel",
    () => {
      outputChannel.show();
    }
  );
  context.subscriptions.push(commandShowOutputChannel);

  const settings = vscode.workspace.getConfiguration(
    "vscode-graphql-execution"
  );
  const registerCodeLens = () => {
    context.subscriptions.push(
      vscode.languages.registerCodeLensProvider(
        [
          "javascript",
          "typescript",
          "javascriptreact",
          "typescriptreact",
          "graphql",
        ],
        new GraphQLCodeLensProvider(outputChannel)
      )
    );
  };

  if (settings.showExecCodelens !== false) {
    registerCodeLens();
  }

  const commandContentProvider = vscode.commands.registerCommand(
    "vscode-graphql-execution.contentProvider",
    async (literal: ExtractedTemplateLiteral) => {
      // Get the selected project from store.
      const { selectedProject } = store;
      if (!selectedProject) {
        vscode.window.showInformationMessage(
          `Missing selected project, please reload configuration and select the project.`
        );
        return;
      }
      if (typeof selectedProject.url !== "string") {
        vscode.window.showInformationMessage(
          `Selected project "${selectedProject.name}", is missing remote url address.`
        );
        return;
      }

      // We want to parse operation types before we do anything from literal.
      const operationTypes: OperationTypeNode[] = [];
      visit(literal.ast, {
        OperationDefinition(node) {
          operationTypes.push(node.operation);
        },
      });

      console.log("literal", literal);
      if (operationTypes.length !== 1) {
        console.error(
          "Error: There are more than one operational types in the literal query definition!"
        );
        return;
      }

      // Only for mutations we are extra safe, we need to ask for confirmation, could be a missclick
      if (operationTypes.join(",") === "mutation") {
        if (
          !(await vscode.window.showInformationMessage(
            `Are you sure your want to execute the ${operationTypes.join(
              ","
            )}? Just to be extra sure! | On (${selectedProject.name}) : ${
              selectedProject.url
            }`,
            `Execute ${operationTypes.join(",")}`
          ))
        ) {
          return;
        }
      }

      const uri = vscode.Uri.parse("graphql://authority/graphql");

      const panel = vscode.window.createWebviewPanel(
        "vscode-graphql-execution.results-preview",
        "GraphQL Execution Result",
        vscode.ViewColumn.Two,
        {}
      );
      context.subscriptions.push(panel);

      const contentProvider = new GraphQLContentProvider(
        uri,
        outputChannel,
        literal,
        panel,
        selectedProject
      );
      context.subscriptions.push(
        panel.onDidDispose(() => {
          contentProvider.dispose();
        })
      );

      const registration = vscode.workspace.registerTextDocumentContentProvider(
        "graphql",
        contentProvider
      );
      context.subscriptions.push(registration);

      const html = await contentProvider.getCurrentHtml();
      panel.webview.html = html;
    }
  );

  context.subscriptions.push(commandContentProvider);
};

export default setupExecuteGraphQLFunctionality;
