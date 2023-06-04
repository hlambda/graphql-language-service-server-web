/*****  Setup a GraphQL subscription observable  ******************************/
import { ApolloClient, InMemoryCache } from "@apollo/client";
import { split, HttpLink } from "@apollo/client";
import { getMainDefinition } from "@apollo/client/utilities";
import { GraphQLWsLink } from "@apollo/client/link/subscriptions";
import { createClient } from "graphql-ws";

// // Hack to make it work when TLS is insecure...
// Ofc for browser this is different story... there could also be mixed content issue.
// process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

const getWsClient = function (wsurl: string, headers: any) {
  const httpLink = new HttpLink({
    uri: "http://localhost:4000/graphql",
  });

  const wsLink = new GraphQLWsLink(
    createClient({
      url: wsurl,
      connectionParams: {
        headers,
      },
    })
  );

  // The split function takes three parameters:
  //
  // * A function that's called for each operation to execute
  // * The Link to use for an operation if the function returns a "truthy" value
  // * The Link to use for an operation if the function returns a "falsy" value
  const splitLink = split(
    ({ query }) => {
      const definition = getMainDefinition(query);
      return (
        definition.kind === "OperationDefinition" &&
        definition.operation === "subscription"
      );
    },
    wsLink,
    httpLink
  );

  const client = new ApolloClient({
    link: splitLink,
    cache: new InMemoryCache(),
  });
  return client;
};

// wsurl: GraphQL endpoint
// query: GraphQL query (use gql`` from the 'graphql-tag' library)
// variables: Query variables object
const createSubscriptionObservable = (
  wsurl: string,
  query: any,
  variables: any,
  headers: string
) => {
  // const link = new WebSocketLink(getWsClient(wsurl, headers));
  const apollo = getWsClient(wsurl, headers);
  return apollo.subscribe({ query, variables });
  // return execute(link, { query: query, variables: variables });
};

/*****************************************************************************/

/*********** Sample usage from your nodejs code ******************************/

export const subscribeToAPI = (
  GRAPHQL_API_ENDPOINT,
  headers,
  subscribeQuery,
  subscribeQueryVariables = {}
) => {
  const SOCKET_URL = GRAPHQL_API_ENDPOINT.replace("http://", "ws://").replace(
    "https://",
    "wss://"
  );

  console.log("Connection url for subscription:", SOCKET_URL);

  const subscriptionClient = createSubscriptionObservable(
    SOCKET_URL, // GraphQL endpoint
    subscribeQuery, // Subscription query
    subscribeQueryVariables, // Query variables
    headers
  );

  return subscriptionClient;
};

export default subscribeToAPI;
