require("dotenv").config();

const ADMIN_DASHBOARD_GRAPHQL_API_INTROSPECTION_URL =
  process.env.ADMIN_DASHBOARD_GRAPHQL_API_INTROSPECTION_URL ??
  "http://localhost:8199";
const MAIN_GRAPHQL_API_INTROSPECTION_URL =
  process.env.MAIN_GRAPHQL_API_INTROSPECTION_URL ?? "http://localhost:8080";

console.log(
  "ADMIN_DASHBOARD_GRAPHQL_API_INTROSPECTION_URL:",
  ADMIN_DASHBOARD_GRAPHQL_API_INTROSPECTION_URL
);
console.log(
  "GRAPHQL_API_INTROSPECTION_URL:",
  MAIN_GRAPHQL_API_INTROSPECTION_URL
);

module.exports = {
  projects: {
    "admin-api": {
      schema: [
        {
          [ADMIN_DASHBOARD_GRAPHQL_API_INTROSPECTION_URL]: {
            headers: {
              "x-hasura-admin-secret": `${
                process.env
                  .ADMIN_DASHBOARD_GRAPHQL_API_INTROSPECTION_HASURA_ADMIN_SECRET ??
                "local-dev"
              }`,
            },
          },
        },
      ],
      documents: "src/**/*.{graphql,tsx,jsx,ts,js}",
      extensions: {
        languageService: {
          cacheSchemaFileForLookup: true,
        },
      },
    },
    "tenant-api": {
      schema: [
        {
          [MAIN_GRAPHQL_API_INTROSPECTION_URL]: {
            headers: {
              "x-hasura-admin-secret": `${
                process.env
                  .MAIN_GRAPHQL_API_INTROSPECTION_HASURA_ADMIN_SECRET ??
                "local-dev"
              }`,
            },
          },
        },
      ],
      documents: "src/**/*.{graphql,tsx,jsx,ts,js}",
      extensions: {
        languageService: {
          cacheSchemaFileForLookup: true,
        },
      },
    },
  },
};
