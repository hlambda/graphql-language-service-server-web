# GraphQL LSP for Web (vscode.dev, github.dev) & vscode

It is based on [LSP web extension example from Microsoft](https://github.com/microsoft/vscode-extension-samples/tree/main/lsp-web-extension-sample) and [graphiql/graphql-language-service-server](https://github.com/graphql/graphiql/tree/main/packages/graphql-language-service-server)
It combines multiple useful packages by the [GraphQL Foundation](https://github.com/graphql/graphiql) and ports them to the vscode web.

To address the original [issue](https://github.com/graphql/graphiql/issues/2112) to port GraphQL LSP to web this extension needed to do some radical changes, like dropping the support for `graphql-config` configuration files. Because the latest version of `graphql-config` package is not designed to run in webworker (it relays on using FS). This is why it is published under different publisher [Hlambda](https://www.hlambda.io/).

Important to note: This is not the official extension by [GraphQL Foundation](https://graphql.org/foundation/) and it is maintained by [Hlambda](https://www.hlambda.io/). To sponsor the work please reach out to [Hlambda](https://www.hlambda.io/) developers.

## Mission

- Create GraphQL LSP Server that can be transpiled for webworker.
- Create package that gives multiple useful features at once, LSP, Syntax Highlighting, Autocomplete, Error checking, Query Execution and Subscription in web.
- Compatible with [Hlambda](https://www.hlambda.io/) web console (Working in a browser, vscode.dev, github.dev)

## Features

- GraphQL syntax highlighting
- **GraphQL LSP server compatible with Web IDE**
- **GraphQL Query/Mutation/Subscription Exec compatible with Web IDE**

## Running

Create new file `graphql.config.experimental.json` in root of one of your vscode workspaces. (at least one, can be more)

! This is not the same configuration as graphql.config from `graphql-config` this is this extension exclusive config file. (Hopefuly once the `graphql-config` package implements web compatible version we can revert on using that.)

Example structure:

```json
{
  "projects": [
    {
      "name": "Hasura API Multi Tenant Admin Dashboard",
      "default": true,
      "url": "{{ADMIN_DASHBOARD_GRAPHQL_API_INTROSPECTION_URL}}",
      "headers": {
        "x-hasura-admin-secret": "{{ADMIN_DASHBOARD_GRAPHQL_API_INTROSPECTION_HASURA_ADMIN_SECRET}}",
        "Authorization": "Bearer ey..."
      }
    }
  ]
}
```

Create new file `.env` or `.env.vscode` if it does not exist in root of the workspace containing `graphql.config.experimental.json`, add values that will be replaced in `graphql.config.experimental.json`, putting this files inside `./metadata/` is also supported, to support "code as metadata" structure in Hlambda.

Example:

```bash
# This values will be used in graphql.config.experimental.json
ADMIN_DASHBOARD_GRAPHQL_API_INTROSPECTION_URL="https://localhost:8080/v1/graphql"
ADMIN_DASHBOARD_GRAPHQL_API_INTROSPECTION_HASURA_ADMIN_SECRET="__my-local-development-password__"
```

Add or remove headers based on your API type (Hasura, Apollo Server, Prisma, something custom, etc.), you can setup **custom headers per project**.
This way you can test your API as a **different role**, just create multiple projects with different headers.

# Issues

Here we list most common issues you may have:

- You can have issue with the CORS or invalid TLS certificates, because this extension is built to be run for in web version of IDE it has to respect browser security standards thus we can't establish connections to remote that does not support CORS or has invalid security cert.

We suggest two approaches;

- one is to use offline schema, you can commit the offline schema and setup GraphQL project to use that instead of pulling it from remote server. (Pros: no request to server, Cons: out of sync with the latest server schema, no ability to exec query/mutation/subscription from vscode)

- second you can use development proxy server that will ignore CORS or Invalid security certs. Using `local-cors-proxy` or `cors-anywhere` (Useful for testing non-local environments)

---

### Development

- Run `npm install` in this folder. This installs all necessary npm modules in both the client and server folder
- Open VS Code on this folder.
- Press Ctrl+Shift+B to compile the client and server.
- Switch to the Debug viewlet.
- Select `Launch Client` from the drop down.
- Run the launch config.
- If you want to debug the server as well use the launch configuration `Attach to Server`
- In the [Extension Development Host] instance of VSCode, open a document in 'javscript' or 'typescript' language mode.

  - Select a GraphQL project or configure a new GraphQL project

  - Type some typescript or javascript

    ```javascript
    const myQuery = doSomethingWithGraphQLString(/* GraphQL */ `
      query getNotes {
        notes {
          content
          subject
          id
        }
      }
      mutation deleteNodes {
        delete_notes(where: {}) {
          affected_rows
        }
      }
      mutation updateNote {
        insert_notes_one(
          object: { content: "Test Note", subject: "Lorem Ipsum..." }
        ) {
          id
          subject
          content
        }
      }
      subscription sub {
        notes {
          content
          subject
          id
        }
      }
    `);
    ```

  - GraphQL decorators will appear

### Compile

You can compile it with:

```
npm run compile
```

### Test in chrome

You can test it in browser using vscode-test-web

```
npm run chrome
```

## Structure

```
.
├── client // Language Client
│   ├── src
│   │   └── browserClientMain.ts // Language Client entry point
├── package.json // The extension manifest.
└── server // Language Server
    └── src
        └── browserServerMain.ts // Language Server entry point
```
