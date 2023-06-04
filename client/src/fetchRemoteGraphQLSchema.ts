/*
	This function should download GraphQL remote schema.
*/

import * as vscode from "vscode";

import introspectionQueryString from "./utils/introspectionQueryString";
import store from "./store";

export const fetchRemoteGraphQLSchema = async (): Promise<{
  responseSchemaJSON: any;
}> => {
  const { selectedProject } = store;
  if (!selectedProject) {
    vscode.window.showInformationMessage(
      `Missing selected project, please reload configuration and select the project.`
    );
    return;
  }

  const responseSchemaJSON = await fetch(selectedProject?.url, {
    headers: {
      accept: "*/*",
      "cache-control": "no-cache",
      "content-type": "application/json",
      pragma: "no-cache",
      ...selectedProject?.headers,
    },
    body: introspectionQueryString,
    method: "POST",
    mode: "cors",
    credentials: "omit",
  })
    .then((response) => {
      return response.json(); // Pare json response
    })
    .then((fullGraphqlResponseJson) => {
      return fullGraphqlResponseJson.data; // Extract only data
    })
    .catch((error) => {
      console.log("Error downloading schema", error);

      vscode.window.showInformationMessage(
        `Error downloading schema ${error.toString(
          true
        )}, possible CORS or CERT issue, check your API url in the browser.`
      );
      return undefined;
    });

  // In web we cant get the exact reason for Failed to fetch error
  // https://bugs.chromium.org/p/chromium/issues/detail?id=718447

  if (!responseSchemaJSON) {
    return;
  }

  console.log("Schema downloaded");
  vscode.window.showInformationMessage(
    `Schema downloaded for project "${selectedProject?.name}"`
  );

  store.responseSchemaJSON = responseSchemaJSON;

  // Also try to send schema update request.
  await vscode.commands.executeCommand(
    "graphql-language-service-server-web.lsp-schema-update-request"
  );

  // Return back the selected projects and projects.
  return { responseSchemaJSON };
};

export default fetchRemoteGraphQLSchema;
