/*
	This function returns the content of the file in a workspace as string or undefined if there was error. 
*/

import * as vscode from "vscode";

export const readWorkspaceFileContents = async (
  workspace: vscode.WorkspaceFolder,
  fileUrl: string,
  silent = true
): Promise<string> => {
  const fileUri = vscode.Uri.joinPath(workspace.uri, fileUrl);
  try {
    await vscode.workspace.fs.stat(fileUri);
    const sampleTextEncoded = await vscode.workspace.fs.readFile(fileUri);
    const sampleText = new TextDecoder("utf-8").decode(sampleTextEncoded);
    return sampleText;
  } catch {
    // No need to show error message, just ignore.
    if (!silent) {
      vscode.window.showInformationMessage(
        `${fileUri.toString(true)} file does *not* exist`
      );
    }
  }
};

export default readWorkspaceFileContents;
