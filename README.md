# GraphQL LSP for Web (vscode.dev, github.dev) & vscode

It is based on [LSP web extension example from Microsoft](https://github.com/microsoft/vscode-extension-samples/tree/main/lsp-web-extension-sample) and [graphiql/graphql-language-service-server](https://github.com/graphql/graphiql/tree/main/packages/graphql-language-service-server)
It combines multiple useful packages by the [GraphQL Foundation](https://github.com/graphql/graphiql) and ports them to the vscode web.

To address the original [issue](https://github.com/graphql/graphiql/issues/2112) to port GraphQL LSP to web this extension needed to do some radical changes, like dropping the support for `graphql-config` configuration files. Because the latest version of `graphql-config` package is not designed to run in webworker (it relays on using FS). This is why it is published under different publisher [Hlambda](https://www.hlambda.io/).

Important to note: This is not the official extension by [GraphQL Foundation](https://graphql.org/foundation/) and it is maintained by [Hlambda](https://www.hlambda.io/). To sponsor the work please reach out to [Hlambda](https://www.hlambda.io/) developers.

[<img src="https://raw.githubusercontent.com/hlambda/graphql-language-service-server-web/main/examples/screenshots/preview.gif" />](https://raw.githubusercontent.com/hlambda/graphql-language-service-server-web/main/examples/screenshots/preview.webm)

## Mission

- Create GraphQL LSP Server that can be transpiled for webworker.
- Create package that gives multiple useful features at once, LSP, Syntax Highlighting, Autocomplete, Error checking, Query Execution and Subscription in web.
- Compatible with [Hlambda](https://www.hlambda.io/) web console (Working in a browser, vscode.dev, github.dev)

## Features

- GraphQL syntax highlighting
- **GraphQL LSP server compatible with Web IDE**
- **Get GraphQL Query/Mutation/Subscription execution results, compatible with Web IDE**

## Running

Create new file `graphql.config.experimental.json` in root of one of your vscode workspaces. (at least one, can be more)

! This is not the same configuration as graphql.config from `graphql-config` this is this extension exclusive config file. (Hopefuly once the `graphql-config` package implements web compatible version we can revert on using that.)

Example structure of `graphql.config.experimental.json` file:

```json
{
  "projects": [
    {
      "name": "Hasura API Multi Tenant Admin Dashboard",
      "default": true,
      "url": "{{MY_GRAPHQL_API_INTROSPECTION_URL}}",
      "headers": {
        "x-hasura-admin-secret": "{{MY_GRAPHQL_API_INTROSPECTION_HASURA_ADMIN_SECRET}}",
        "Authorization": "Bearer ey..."
      }
    }
  ]
}
```

Create new file `graphql.config.experimental.json` in root of the workspace.
Then add `.env` or `.env.vscode` to the same workspace, add values that will be replaced in `graphql.config.experimental.json`. Putting this files inside `./metadata/` is also supported, to support "code as metadata" structure for Hlambda projects.

Example structure of `.env` file:

```bash
# Note; you can use any env variable name you like. In the file: graphql-lsp-web.config.experimental.json
# by using this syntax: "{{MY_CUSTOM_VAR_NAME}}""

MY_GRAPHQL_API_INTROSPECTION_URL="http://localhost:8080/v1/graphql"
MY_GRAPHQL_API_INTROSPECTION_HASURA_ADMIN_SECRET="__my-local-development-password__"
#MY_GRAPHQL_API_INTROSPECTION_AUTHORIZATION_HEADER_VALUE=""

```

Add or remove headers based on your API type (Hasura, Apollo Server, Prisma, something custom, etc.), you can setup **custom headers per project**.
This way you can test your API as a **different role**, just create multiple projects with different headers.

# Issues

Here we list most common issues you may have:

- You can have issue with the CORS or invalid TLS certificates, because this extension is built to be run in web version of IDE it has to respect browser security standards thus we can't establish connections to remote that does not support CORS or has invalid security cert.

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
