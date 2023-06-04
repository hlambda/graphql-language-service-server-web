import * as vscode from "vscode";

export default function getConfig() {
  return vscode.workspace.getConfiguration(
    "vscode-graphql-execution",
    vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.document.uri
      : null
  );
}
