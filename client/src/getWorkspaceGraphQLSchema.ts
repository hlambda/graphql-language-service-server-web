/*
	This function should download GraphQL remote schema.
*/

import * as vscode from "vscode";

import readWorkspaceFileContents from "./utils/readWorkspaceFileContents";
import store from "./store";

export const getWorkspaceGraphQLSchema = async (): Promise<{
  responseSchemaJSON: any;
}> => {
  const { selectedProject } = store;
  if (!selectedProject) {
    vscode.window.showInformationMessage(
      `Missing selected project, please reload configuration and select the project.`
    );
    return;
  }
  if (
    !(typeof selectedProject?.file === "string" && selectedProject?.file !== "")
  ) {
    vscode.window.showInformationMessage(
      `Selected project does not have valid file param.`
    );
    return;
  }

  // Search through multiple workspaces... localfs, inmem, remote, etc...
  const workspaces = await Promise.all(
    vscode.workspace.workspaceFolders.map(async (workspace) => {
      let offlineGraphQLSchemaContent: string | undefined;

      const offlineGraphQLSchemaFileListToCheck = [
        `${selectedProject.file}`,
        `metadata/${selectedProject.file}`, // Hlambda support
      ];
      for (let i = 0; i < offlineGraphQLSchemaFileListToCheck.length; i++) {
        const fileToCheck = offlineGraphQLSchemaFileListToCheck[i];
        if (typeof offlineGraphQLSchemaContent === "undefined") {
          offlineGraphQLSchemaContent = await readWorkspaceFileContents(
            workspace,
            fileToCheck
          );
          if (typeof offlineGraphQLSchemaContent !== "undefined") {
            console.log(`Loaded graphql projects from ${fileToCheck}`);
            return {
              workspace,
              offlineGraphQLSchemaContent,
              file: fileToCheck,
            };
          }
        } else {
          break;
        }
      }

      return {
        workspace,
        offlineGraphQLSchemaContent,
        file: "",
      };
    })
  );

  // --------------------------------------------------------------------------------
  // Lets find offline content target
  let target = { target: undefined };

  if (workspaces.length === 1) {
    target.target = workspaces[0];
  } else {
    // Select from workspaces if multiple...
    target = await vscode.window.showQuickPick(
      workspaces.map((item, index) => {
        return {
          label: `Load file from workspace: ${item?.workspace.name}`,
          description: `${item?.file}`,
          target: item,
        };
      })
    );
  }

  let responseSchemaJSON;
  try {
    responseSchemaJSON = JSON.parse(
      target?.target?.offlineGraphQLSchemaContent
    );
  } catch (error) {
    console.log(error);
  }

  if (!responseSchemaJSON) {
    vscode.window.showInformationMessage(
      `No GraphQL schema file found in local workspaces for project "${selectedProject?.name}"`
    );
    return;
  }

  console.log("Schema found in local workspace");
  vscode.window.showInformationMessage(
    `GraphQL schema file (${target?.target?.file}) found in local workspace "${target?.target?.workspace?.name}" for project "${selectedProject?.name}"`
  );

  store.responseSchemaJSON = responseSchemaJSON;

  // Also try to send schema update request.
  await vscode.commands.executeCommand(
    "graphql-language-service-server-web.lsp-schema-update-request"
  );

  // Return back the selected projects and projects.
  return { responseSchemaJSON };
};

export default getWorkspaceGraphQLSchema;
