/*
	This function should load the configs in available workspaces, give ability to select project,
	download GraphQL schema and
*/

import * as vscode from "vscode";
import { LanguageClient } from "vscode-languageclient/browser";

import parseDotEnvContent from "./utils/parseDotEnvContent";
import readWorkspaceFileContents from "./utils/readWorkspaceFileContents";

import store from "./store";

export const loadGraphQLProjectConfigs = async (
  isFirstStartup = false
): Promise<{
  allProjectsFromAllWorkspaces: any;
  selectedProject: any;
}> => {
  // First thing we can do is to try to load the .env file and graphql.config file to parse projects in workspace

  // Go through every workspace folder.
  const workspaces = await Promise.all(
    vscode.workspace.workspaceFolders.map(async (workspace) => {
      // const message = `Found workspace ${workspace.uri.toString()}`;
      // vscode.window.showInformationMessage(message);

      let dotEnvFileText: string | undefined;

      const dotEnvFileListToCheck = [
        ".env",
        ".env.vscode", // .env is not found, try ".env.vscode" (Because this is env for vscode extension)
        "metadata/.env", // .env is not found, try ./metadata/.env | Hlambda support
        "metadata/.env.vscode", // .env is not found, try ".env.vscode" (Because this is env for extension) |  Hlambda support
      ];
      for (let i = 0; i < dotEnvFileListToCheck.length; i++) {
        const fileToCheck = dotEnvFileListToCheck[i];
        if (typeof dotEnvFileText === "undefined") {
          dotEnvFileText = await readWorkspaceFileContents(
            workspace,
            fileToCheck
          );
          if (typeof dotEnvFileText !== "undefined") {
            console.log(`Loaded extension envs from ${fileToCheck}`);
          }
        } else {
          break;
        }
      }

      let workspaceEnvironmentVariables = {};
      try {
        workspaceEnvironmentVariables = {
          ...parseDotEnvContent(dotEnvFileText ?? ""),
        };
      } catch (error) {
        console.log(error);
      }

      let experimentalProjectConfigContent: string | undefined;

      const experimentalProjectConfigFileListToCheck = [
        "graphql.config.experimental.json",
        ".graphql.config.experimental.json",
        "vscode.graphql.config.json",
        ".vscode.graphql.config.json",
        "metadata/graphql.config.experimental.json", // Hlambda support
        "metadata/.graphql.config.experimental.json", //  Hlambda support
        "metadata/vscode.graphql.config.json", //  Hlambda support
        "metadata/.vscode.graphql.config.json", //  Hlambda support
      ];
      for (
        let i = 0;
        i < experimentalProjectConfigFileListToCheck.length;
        i++
      ) {
        const fileToCheck = experimentalProjectConfigFileListToCheck[i];
        if (typeof experimentalProjectConfigContent === "undefined") {
          experimentalProjectConfigContent = await readWorkspaceFileContents(
            workspace,
            fileToCheck
          );
          if (typeof experimentalProjectConfigContent !== "undefined") {
            console.log(`Loaded graphql projects from ${fileToCheck}`);
          }
        } else {
          break;
        }
      }

      let experimentalProjectConfig = { projects: [] };
      try {
        experimentalProjectConfig = JSON.parse(
          experimentalProjectConfigContent
        );

        // For every key in env variables, we want to replace placeholders in string types of the object.
      } catch (error) {
        console.log(error);
      }

      return {
        workspace,
        workspaceEnvironmentVariables,
        experimentalProjectConfig,
      };
    })
  );

  // Fill the project object with the env variable values.
  const allProjectsFromAllWorkspaces = workspaces.reduce((acc, item) => {
    const projects = item?.experimentalProjectConfig?.projects ?? [];
    const workspaceEnvironmentVariables =
      item?.workspaceEnvironmentVariables ?? {};
    projects.map((project) => {
      // We want to support key replacing also, but that can't be done by "black magic" parse(stringify()) replacer function.
      const xObjectKeyTransformFromEnv = (obj: any) => {
        return Object.keys(obj).reduce((acc, key) => {
          let valueOfTheKeyOfTheObject = key;
          let valueOfTheObject = obj[key];

          // Recursion
          if (typeof valueOfTheObject === "string") {
            for (const [keyEnv, valueEnv] of Object.entries(
              workspaceEnvironmentVariables
            )) {
              if (typeof valueOfTheKeyOfTheObject === "string") {
                valueOfTheKeyOfTheObject = valueOfTheKeyOfTheObject.replace(
                  `{{${keyEnv}}}`,
                  `${valueEnv}`
                );
              }
            }
          } else if (typeof valueOfTheObject === "object") {
            valueOfTheObject = xObjectKeyTransformFromEnv(valueOfTheObject);
          }

          acc[valueOfTheKeyOfTheObject] = valueOfTheObject;
          return acc;
        }, {});
      };
      const projectWithReplacedKeysWithEnvValues =
        xObjectKeyTransformFromEnv(project);

      // Update: The fun part is now we don't need black magic with the json stringify replacer because we already are iterating through all values.

      // At this point we can also do some magic, replace the configs with the workspaces env values we parsed before.
      // WARNING BLACK MAGIC
      const projectWithEnvValues = JSON.parse(
        JSON.stringify(projectWithReplacedKeysWithEnvValues, (key, value) => {
          let newValue = value;
          for (const [keyEnv, valueEnv] of Object.entries(
            workspaceEnvironmentVariables
          )) {
            if (typeof value === "string") {
              newValue = newValue.replace(`{{${keyEnv}}}`, valueEnv);
            }
          }
          return newValue;
        })
      );
      // Black magic ended, you survived ;)
      acc.push({
        ...projectWithEnvValues,
      });
    });
    return acc;
  }, []);

  // --------------------------------------------------------------------------------

  // Be smart, first check if there is only one project or at least 1 default project
  let target = { target: undefined };
  const findFirstDefaultProject = allProjectsFromAllWorkspaces.find(
    (o) => o?.default === true
  );
  if (allProjectsFromAllWorkspaces.length === 0) {
    // Nothing to do here... no project are found.
    if (!isFirstStartup) {
      vscode.window.showInformationMessage(
        "No project to select, please setup your projects in the GraphQL project config file."
      );
    }
    return;
  } else if (allProjectsFromAllWorkspaces.length === 1) {
    target.target = allProjectsFromAllWorkspaces[0];
  } else if (findFirstDefaultProject) {
    target.target = findFirstDefaultProject;
  } else {
    // Select from workspaces if multiple...
    target = await vscode.window.showQuickPick(
      allProjectsFromAllWorkspaces.map((item, index) => {
        return {
          label: `Project: ${item?.name}`,
          description: `${item?.file ?? item?.url}`, // Target can have file url
          target: item,
        };
      })
    );
  }

  const selectedProject = target?.target;
  if (!selectedProject) {
    if (!isFirstStartup) {
      vscode.window.showInformationMessage(
        "No project was selected, please select project to continue."
      );
    }
    return;
  }

  // Save selected project and all configs to store.
  store.selectedProject = selectedProject;
  store.allProjectsFromAllWorkspaces = allProjectsFromAllWorkspaces;

  if (typeof selectedProject.file === "string") {
    // Load local workspace file
    await vscode.commands.executeCommand(
      "graphql-language-service-server-web.fetch-workspace-graphql-schema-from-selected-project"
    );
  } else if (typeof selectedProject.url === "string") {
    // Request the remote schema download
    await vscode.commands.executeCommand(
      "graphql-language-service-server-web.fetch-remote-graphql-schema-from-selected-project",
      selectedProject
    );
  } else {
    console.log("Project does not have; url nor file");
  }

  // Return back the selected projects and projects.
  return { allProjectsFromAllWorkspaces, selectedProject };
};

export default loadGraphQLProjectConfigs;
