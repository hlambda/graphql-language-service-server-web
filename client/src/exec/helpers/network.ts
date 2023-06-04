import { visit, OperationTypeNode, GraphQLError } from "graphql";
import { gql } from "graphql-tag";
// import * as ws from "ws";
import { OutputChannel, workspace } from "vscode";

import { createClient as createWSClient, OperationResult } from "graphql-ws";

import {
  ExtractedTemplateLiteral,
  SourceHelper,
  getFragmentDependenciesForAST,
} from "./source";

import { UserVariables } from "../providers/exec-content";

// import { pipe, subscribe } from "wonka";
// import {
//   CombinedError,
//   createClient,
//   defaultExchanges,
//   subscriptionExchange,
// } from "@urql/core";

import subscribeToAPI from "./subscriber";

export class NetworkHelper {
  private outputChannel: OutputChannel;
  private sourceHelper: SourceHelper;

  private consumer;

  constructor(outputChannel: OutputChannel, sourceHelper: SourceHelper) {
    this.outputChannel = outputChannel;
    this.sourceHelper = sourceHelper;
  }

  // private buildClient({
  //   operation,
  //   endpoint,
  //   updateCallback,
  // }: {
  //   operation: string;
  //   endpoint: any;
  //   updateCallback: (data: string, operation: string) => void;
  // }) {
  //   const { rejectUnauthorized } = workspace.getConfiguration("vscode-graphql");
  //   // this is a node specific setting that can allow requests against servers using self-signed certificates
  //   // it is similar to passing the nodejs env variable flag, except configured on a per-request basis here

  //   const exchanges = [...defaultExchanges];
  //   if (operation === "subscription") {
  //     const wsEndpointURL = endpoint.url.replace(/^http/, "ws");
  //     const wsClient = createWSClient({
  //       url: wsEndpointURL,
  //       connectionAckWaitTimeout: 3000,
  //       // webSocketImpl: ws,
  //     });
  //     exchanges.push(
  //       subscriptionExchange({
  //         forwardSubscription: (op) => ({
  //           subscribe: (sink) => ({
  //             unsubscribe: wsClient.subscribe(op, sink),
  //           }),
  //         }),
  //       })
  //     );
  //   }

  //   return createClient({
  //     url: endpoint.url,
  //     fetchOptions: {
  //       headers: endpoint?.headers ?? {},
  //     },
  //     exchanges,
  //   });
  // }

  // buildSubscribeConsumer =
  //   (cb: ExecuteOperationOptions["updateCallback"], operation: string) =>
  //   (result: OperationResult) => {
  //     const { errors, data, error } = result as {
  //       error?: CombinedError;
  //       errors?: GraphQLError[];
  //       data?: unknown;
  //     };

  //     if (errors || data) {
  //       cb(formatData(result), operation);
  //     }
  //     if (error) {
  //       if (error.graphQLErrors && error.graphQLErrors.length > 0) {
  //         cb(
  //           JSON.stringify({ errors: error.graphQLErrors }, null, 2),
  //           operation
  //         );
  //       }
  //       if (error.networkError) {
  //         cb(error.networkError.toString(), operation);
  //       }
  //     }
  //   };

  async executeOperation({
    endpoint,
    literal,
    variables,
    updateCallback,
  }: ExecuteOperationOptions) {
    const operationTypes: OperationTypeNode[] = [];

    visit(literal.ast, {
      OperationDefinition(node) {
        operationTypes.push(node.operation);
      },
    });
    // const fragmentDefinitions = await this.sourceHelper.getFragmentDefinitions(
    //   projectConfig
    // );

    // const fragmentInfos = await getFragmentDependenciesForAST(
    //   literal.ast,
    //   fragmentDefinitions
    // );

    // for (const fragmentInfo of fragmentInfos) {
    //   literal.content = fragmentInfo.content + "\n" + literal.content;
    // }
    const parsedOperation = gql(literal.content);

    return Promise.all(
      operationTypes.map(async (operation) => {
        // const subscriber = this.buildSubscribeConsumer(
        //   updateCallback,
        //   operation
        // );
        // this.outputChannel.appendLine(`NetworkHelper: operation: ${operation}`);
        // this.outputChannel.appendLine(
        //   `NetworkHelper: endpoint: ${endpoint.url}`
        // );
        try {
          // const urqlClient = this.buildClient({
          //   operation,
          //   endpoint,
          //   updateCallback,
          // });
          if (operation === "subscription") {
            console.log("STARTING SUBSCRIBE! ");

            const subscriptionClient = subscribeToAPI(
              endpoint.url,
              endpoint?.headers,
              parsedOperation,
              variables
            );

            const consumer = subscriptionClient.subscribe(
              (eventData) => {
                // Do something on receipt of the event
                console.log("Received GraphQL event: ");
                console.log(JSON.stringify(eventData, null, 2));
                updateCallback(
                  JSON.stringify(eventData, null, 2),
                  operation,
                  endpoint
                );
              },
              (err) => {
                console.log("Err");
                console.log(err);
              }
            );
            this.consumer = consumer;

            // this.listOfSubscriptions.push({
            //   consumer,
            // });

            // setTimeout(() => {
            //   consumer.unsubscribe();
            // }, 15000);

            // pipe(
            //   urqlClient.subscription(parsedOperation, variables),
            //   subscribe(subscriber)
            // );
          } else if (operation === "query") {
            const responseExecuteGraphQL = await fetch(endpoint?.url, {
              headers: {
                accept: "*/*",
                "cache-control": "no-cache",
                "content-type": "application/json",
                pragma: "no-cache",
                ...endpoint?.headers,
              },
              body: JSON.stringify({
                query: literal.content,
                variables,
              }),
              method: "POST",
              mode: "cors",
              credentials: "omit",
            })
              .then((response) => {
                return response.text();
              })
              .then((fullGraphqlResponseAsText) => {
                return fullGraphqlResponseAsText;
              })
              .catch((error) => {
                console.log(error);
                return undefined;
              });

            if (responseExecuteGraphQL) {
              updateCallback(responseExecuteGraphQL, operation, endpoint);
            }

            // pipe(
            //   urqlClient.query(parsedOperation, variables),
            //   subscribe(subscriber)
            // );
          } else {
            // pipe(
            //   urqlClient.mutation(literal.content, variables),
            //   subscribe(subscriber)
            // );
            const responseExecuteGraphQL = await fetch(endpoint?.url, {
              headers: {
                accept: "*/*",
                "cache-control": "no-cache",
                "content-type": "application/json",
                pragma: "no-cache",
                ...endpoint?.headers,
              },
              body: JSON.stringify({
                query: literal.content,
                variables,
              }),
              method: "POST",
              mode: "cors",
              credentials: "omit",
            })
              .then((response) => {
                return response.text();
              })
              .then((fullGraphqlResponseAsText) => {
                return fullGraphqlResponseAsText;
              })
              .catch((error) => {
                console.log(error);
                return undefined;
              });

            if (responseExecuteGraphQL) {
              updateCallback(responseExecuteGraphQL, operation, endpoint);
            }
          }
        } catch (err) {
          console.log(err);
          this.outputChannel.appendLine(`error executing operation:\n${err}`);
        }
      })
    );
  }

  public dispose() {
    console.log("Disposing old subscriptions!");
    if (this.consumer) {
      this.consumer?.unsubscribe();
      console.log("Done, clean subscription exit...");
    }
  }
}

export interface ExecuteOperationOptions {
  endpoint: any;
  literal: ExtractedTemplateLiteral;
  variables: UserVariables;
  updateCallback: (data: string, operation: string, endpoint?: any) => void;
}

function formatData({ data, errors }: any) {
  return JSON.stringify({ data, errors }, null, 2);
}
