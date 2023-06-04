import {
  CachedContent,
  Uri,
  GraphQLConfig,
  GraphQLCache,
  GraphQLProjectConfig,
  FileChangeTypeKind,
  Range,
  Position,
  IPosition,
} from "graphql-language-service";

import {
  Outline,
  OutlineTree,
  getAutocompleteSuggestions,
  getHoverInformation,
  HoverConfig,
  validateQuery,
  getRange,
  DIAGNOSTIC_SEVERITY,
  getOutline,
  getDefinitionQueryResultForFragmentSpread,
  getDefinitionQueryResultForDefinitionNode,
  getDefinitionQueryResultForNamedType,
  getDefinitionQueryResultForField,
  DefinitionQueryResult,
  getASTNodeAtPosition,
  getTokenAtPosition,
  getTypeInfo,
  getDiagnostics,
} from "graphql-language-service";

import { buildSchema, buildClientSchema, GraphQLSchema } from "graphql";
import { testSchema } from "./testSchema";

import { GraphQLLanguageService } from "./GraphQLLanguageService";

import type {
  CompletionParams,
  FileEvent,
  VersionedTextDocumentIdentifier,
  DidSaveTextDocumentParams,
  DidOpenTextDocumentParams,
  DidChangeConfigurationParams,
  Diagnostic,
  CompletionItem,
  CompletionList,
  CancellationToken,
  Hover,
  InitializeResult,
  Location,
  PublishDiagnosticsParams,
  DidChangeTextDocumentParams,
  DidCloseTextDocumentParams,
  DidChangeWatchedFilesParams,
  InitializeParams,
  Range as RangeType,
  Position as VscodePosition,
  TextDocumentPositionParams,
  DocumentSymbolParams,
  SymbolInformation,
  WorkspaceSymbolParams,
  Connection,
  DidChangeConfigurationRegistrationOptions,
  Logger,
} from "vscode-languageserver/browser";

import { parseDocument, DEFAULT_SUPPORTED_EXTENSIONS } from "./parseDocument";

import { printSchema, visit, parse, FragmentDefinitionNode } from "graphql";
// import { getGraphQLCache, GraphQLCache } from "./GraphQLCache";
import { extname } from "path-browserify";

// import {
//   ConfigEmptyError,
//   ConfigInvalidError,
//   ConfigNotFoundError,
//   GraphQLExtensionDeclaration,
//   LoaderNoResultError,
//   ProjectNotFoundError,
// } from "graphql-config";

// import type { UnnormalizedTypeDefPointer } from '@graphql-tools/load';
// import { getGraphQLCache, GraphQLCache } from './GraphQLCache';

// import type { LoadConfigOptions } from './types';

import {
  DocumentNode,
  FragmentSpreadNode,
  TypeDefinitionNode,
  NamedTypeNode,
  ValidationRule,
  FieldNode,
  GraphQLError,
  Kind,
  print,
  isTypeDefinitionNode,
} from "graphql";

// --------------------------------------------------------------------------------

type CachedDocumentType = {
  version: number;
  contents: CachedContent[];
};

function toPosition(position: VscodePosition): IPosition {
  return new Position(position.line, position.character);
}

// --------------------------------------------------------------------------------

export class MessageProcessorWeb {
  _connection: Connection;
  _graphQLCache!: GraphQLCache;
  _graphQLConfig: GraphQLConfig | undefined;
  _languageService!: GraphQLLanguageService;
  _textDocumentCache = new Map<string, CachedDocumentType>();
  _isInitialized = false;
  _isGraphQLConfigMissing: boolean | null = null;
  _willShutdown = false;
  _logger: Logger;
  // _extensions?: GraphQLExtensionDeclaration[];
  _parser: (text: string, uri: string) => CachedContent[];
  //   _tmpDir: string;
  //   _tmpUriBase: string;
  //   _tmpDirBase: string;
  // _loadConfigOptions: LoadConfigOptions;
  _schemaCacheInit = false;
  // _rootPath: string = process.cwd();
  _settings: any;

  // Debug
  _schema: GraphQLSchema | undefined;

  constructor({
    logger,
    fileExtensions,
    graphqlFileExtensions,
    // loadConfigOptions,
    config,
    parser,
    connection,
  }: {
    logger: Logger;
    fileExtensions: string[];
    graphqlFileExtensions: string[];
    // loadConfigOptions: LoadConfigOptions;
    config?: GraphQLConfig;
    parser?: typeof parseDocument;
    connection: Connection;
  }) {
    this._connection = connection;
    this._logger = logger;
    this._graphQLConfig = config;
    this._parser = (text, uri) => {
      const p = parser ?? parseDocument;
      return p(text, uri, fileExtensions, graphqlFileExtensions, this._logger);
    };
  }

  get connection(): Connection {
    return this._connection;
  }
  set connection(connection: Connection) {
    this._connection = connection;
  }

  /*
    Class debugging method
  */
  manualInit() {
    this._isInitialized = true;
    this._isGraphQLConfigMissing = false;
    this._languageService = new GraphQLLanguageService(
      this._graphQLCache,
      this._logger
    );
    return null;
  }

  async setSchema(params: any): Promise<any[]> {
    this._schema = buildClientSchema(params?.responseSchemaJSON);

    // A hack, whenever there is a new schema sent to LSP, we should "reopen all files" to get the new diagnositc information
    // Reload diagnostics for opened document if any.
    let allFilesDiagnosticResults = [];
    try {
      const textDocuments = params?.textDocuments ?? [];
      allFilesDiagnosticResults = await Promise.all(
        textDocuments.map((textDocument: any) => {
          // console.log(textDocument, "Debug");
          const singleFileDiagnosticResults =
            this.handleDidOpenOrSaveNotification({ textDocument });
          return singleFileDiagnosticResults;
        })
      );
      // eslint-disable-next-line no-empty
    } catch (error) {
      console.log("reloading text documents", error);
    }

    console.log(
      "Resending back diagnostics! Reloaded everything need to do this",
      allFilesDiagnosticResults
    );

    this._logger.info(
      JSON.stringify({
        type: "usage",
        messageType: "updateSchema",
      })
    );
    return allFilesDiagnosticResults;
  }

  async handleInitializeRequest(
    params: InitializeParams,
    _token?: CancellationToken,
    configDir?: string
  ): Promise<InitializeResult> {
    if (!params) {
      throw new Error("`params` argument is required to initialize.");
    }

    const serverCapabilities: InitializeResult = {
      capabilities: {
        workspaceSymbolProvider: true,
        documentSymbolProvider: true,
        completionProvider: {
          resolveProvider: true,
          triggerCharacters: [" ", ":", "$", "(", "@", "\n", ",", "{"],
        },
        definitionProvider: true,
        textDocumentSync: 1,
        hoverProvider: true,
        workspace: {
          workspaceFolders: {
            supported: true,
            changeNotifications: true,
          },
        },
        // // debug
        // colorProvider: {}, // provide a color provider
      },
    };

    if (!serverCapabilities) {
      throw new Error("GraphQL Language Server is not initialized.");
    }

    this._logger.info(
      JSON.stringify({
        type: "usage",
        messageType: "initialize",
      })
    );

    return serverCapabilities;
  }

  async handleCompletionRequest(
    params: CompletionParams
  ): Promise<CompletionList | Array<CompletionItem>> {
    if (!this._isInitialized) {
      return [];
    }
    this.validateDocumentAndPosition(params);

    const { textDocument, position } = params;

    // `textDocument/completion` event takes advantage of the fact that
    // `textDocument/didChange` event always fires before, which would have
    // updated the cache with the query text from the editor.
    // Treat the computed list always complete.

    const cachedDocument = this._getCachedDocument(textDocument.uri);
    if (!cachedDocument) {
      return [];
    }

    const found = cachedDocument.contents.find((content) => {
      const currentRange = content.range;
      if (currentRange?.containsPosition(toPosition(position))) {
        return true;
      }
    });

    // If there is no GraphQL query in this file, return an empty result.
    if (!found) {
      return [];
    }

    const { query, range } = found;

    if (range) {
      position.line -= range.start.line;
    }

    // // OLD
    // const result = await this._languageService.getAutocompleteSuggestions(
    //   query,
    //   toPosition(position),
    //   textDocument.uri
    // );
    const schema = this._schema;

    // NEW
    if (!schema) {
      return [];
    }
    const result = getAutocompleteSuggestions(
      schema,
      query,
      toPosition(position),
      undefined
      // fragmentInfo,
      // {
      //   uri: filePath,
      //   fillLeafsOnComplete:
      //     projectConfig?.extensions?.languageService?.fillLeafsOnComplete ??
      //     false,
      // }
    );

    // const project = this._graphQLCache.getProjectForFile(textDocument.uri);

    this._logger.log(
      JSON.stringify({
        type: "usage",
        messageType: "textDocument/completion",
        // projectName: project?.name,
        fileName: textDocument.uri,
      })
    );

    return { items: JSON.parse(JSON.stringify(result)), isIncomplete: false };
  }

  async handleDidOpenOrSaveNotification(
    params: DidSaveTextDocumentParams | DidOpenTextDocumentParams
  ): Promise<PublishDiagnosticsParams | null> {
    /**
     * Initialize the LSP server when the first file is opened or saved,
     * so that we can access the user settings for config rootDir, etc
     */
    try {
      if (!this._isInitialized /* || !this._graphQLCache */) {
        // don't try to initialize again if we've already tried
        // and the graphql config file or package.json entry isn't even there
        if (this._isGraphQLConfigMissing === true) {
          return null;
        }
        // then initial call to update graphql config
        // await this._updateGraphQLConfig();
      }
    } catch (err) {
      this._logger.error(String(err));
    }

    // Here, we set the workspace settings in memory,
    // and re-initialize the language service when a different
    // root path is detected.
    // We aren't able to use initialization event for this
    // and the config change event is after the fact.

    if (!params?.textDocument) {
      throw new Error("`textDocument` argument is required.");
    }
    const { textDocument } = params;
    const { uri } = textDocument;

    const diagnostics: Diagnostic[] = [];

    let contents: CachedContent[] = [];
    const text = "text" in textDocument && textDocument.text;
    // Create/modify the cached entry if text is provided.
    // Otherwise, try searching the cache to perform diagnostics.
    if (text) {
      // textDocument/didSave does not pass in the text content.
      // Only run the below function if text is passed in.
      contents = this._parser(text, uri);

      await this._invalidateCache(textDocument, uri, contents);
    } else {
      // No diagnostics for you... This file is not in the cache
      // const configMatchers = [
      //   "graphql.config",
      //   "graphqlrc",
      //   "graphqlconfig",
      // ].filter(Boolean);

      // const hasGraphQLConfigFile = configMatchers.some(
      //   (v) => uri.match(v)?.length
      // );
      // if (hasGraphQLConfigFile) {
      //   this._logger.info("Updating graphql config");
      //   // await this._updateGraphQLConfig();
      //   return { uri, diagnostics: [] };
      // }
      // // Update graphql config only when graphql config is saved!
      // const cachedDocument = this._getCachedDocument(uri);
      // if (cachedDocument) {
      //   contents = cachedDocument.contents;
      // }
      return null;
    }
    // if (!this._graphQLCache) {
    //   return { uri, diagnostics };
    // }

    const schema = this._schema;

    if (!schema) {
      return { uri, diagnostics };
    }

    try {
      // const project = this._graphQLCache.getProjectForFile(uri);
      if (
        this._isInitialized
        // &&
        // project?.extensions?.languageService?.enableValidation !== false
      ) {
        await Promise.all(
          contents.map(async ({ query, range }) => {
            // const results = await this._languageService.getDiagnostics(
            //   query,
            //   uri,
            //   this._isRelayCompatMode(query)
            // );
            const results = getDiagnostics(
              //cachedDocument.contents[0].query, // BUG! [0]
              query,
              schema
            );
            if (results && results.length > 0) {
              diagnostics.push(
                ...processDiagnosticsMessage(results, query, range)
              );
            }
          })
        );
      }

      this._logger.log(
        JSON.stringify({
          type: "usage",
          messageType: "textDocument/didOpenOrSave",
          // projectName: project?.name,
          fileName: uri,
        })
      );
    } catch (err) {
      // this._handleConfigError({ err, uri });
    }

    return JSON.parse(JSON.stringify({ uri, diagnostics }));
  }

  async handleDidChangeNotification(
    params: DidChangeTextDocumentParams
  ): Promise<PublishDiagnosticsParams | null> {
    if (
      this._isGraphQLConfigMissing ||
      !this._isInitialized
      // || !this._graphQLCache
    ) {
      return null;
    }
    // For every `textDocument/didChange` event, keep a cache of textDocuments
    // with version information up-to-date, so that the textDocument contents
    // may be used during performing language service features,
    // e.g. auto-completions.
    if (!params?.textDocument?.uri || !params.contentChanges) {
      throw new Error(
        "`textDocument.uri` and `contentChanges` arguments are required."
      );
    }
    const { textDocument, contentChanges } = params;
    const { uri } = textDocument;
    // const project = this._graphQLCache.getProjectForFile(uri);
    try {
      const contentChange = contentChanges.at(-1)!;

      // As `contentChanges` is an array, and we just want the
      // latest update to the text, grab the last entry from the array.
      // If it's a .js file, try parsing the contents to see if GraphQL queries
      // exist. If not found, delete from the cache.
      const contents = this._parser(contentChange.text, uri);
      // If it's a .graphql file, proceed normally and invalidate the cache.
      await this._invalidateCache(textDocument, uri, contents);
      const cachedDocument = this._getCachedDocument(uri);

      if (!cachedDocument) {
        return null;
      }

      // await this._updateFragmentDefinition(uri, contents);
      // await this._updateObjectTypeDefinition(uri, contents);

      const diagnostics: Diagnostic[] = [];

      // OLD
      // if (project?.extensions?.languageService?.enableValidation !== false) {
      //   // Send the diagnostics onChange as well
      //   await Promise.all(
      //     contents.map(async ({ query, range }) => {
      //       const results = await this._languageService.getDiagnostics(
      //         query,
      //         uri,
      //         this._isRelayCompatMode(query)
      //       );
      //       if (results && results.length > 0) {
      //         diagnostics.push(
      //           ...processDiagnosticsMessage(results, query, range)
      //         );
      //       }
      //     })
      //   );
      // }

      // NEW
      // Send the diagnostics onChange as well
      const getDiagnosticsCustom = async (
        document: string,
        uri: Uri,
        isRelayCompatMode?: boolean
      ): Promise<Array<Diagnostic>> => {
        // Perform syntax diagnostics first, as this doesn't require
        // schema/fragment definitions, even the project configuration.
        let documentHasExtensions = false;

        // skip validation when there's nothing to validate, prevents noisy unexpected EOF errors
        if (
          // !projectConfig ||
          !document ||
          document.trim().length < 2
        ) {
          return [];
        }

        const schema = this._schema;

        if (!schema) {
          return [];
        }

        try {
          const documentAST = parse(document);
          documentHasExtensions = documentAST.definitions.some((definition) => {
            switch (definition.kind) {
              case Kind.OBJECT_TYPE_DEFINITION:
              case Kind.INTERFACE_TYPE_DEFINITION:
              case Kind.ENUM_TYPE_DEFINITION:
              case Kind.UNION_TYPE_DEFINITION:
              case Kind.SCALAR_TYPE_DEFINITION:
              case Kind.INPUT_OBJECT_TYPE_DEFINITION:
              case Kind.SCALAR_TYPE_EXTENSION:
              case Kind.OBJECT_TYPE_EXTENSION:
              case Kind.INTERFACE_TYPE_EXTENSION:
              case Kind.UNION_TYPE_EXTENSION:
              case Kind.ENUM_TYPE_EXTENSION:
              case Kind.INPUT_OBJECT_TYPE_EXTENSION:
              case Kind.DIRECTIVE_DEFINITION:
                return true;
            }

            return false;
          });
        } catch (error) {
          if (error instanceof GraphQLError) {
            const range = getRange(
              error.locations?.[0] ?? { column: 0, line: 0 },
              document
            );
            return [
              {
                severity: DIAGNOSTIC_SEVERITY.Error,
                message: error.message,
                source: "GraphQL: Syntax",
                range,
              },
            ];
          }

          throw error;
        }

        // If there's a matching config, proceed to prepare to run validation
        let source = document;
        // const fragmentDefinitions =
        //   await this._graphQLCache.getFragmentDefinitions(projectConfig);

        // const fragmentDependencies =
        //   await this._graphQLCache.getFragmentDependencies(
        //     document,
        //     fragmentDefinitions
        //   );

        // const dependenciesSource = fragmentDependencies.reduce(
        //   (prev, cur) => `${prev} ${print(cur.definition)}`,
        //   ""
        // );

        // source = `${source} ${dependenciesSource}`;
        source = `${source}`;

        let validationAst = null;
        try {
          validationAst = parse(source);
        } catch {
          // the query string is already checked to be parsed properly - errors
          // from this parse must be from corrupted fragment dependencies.
          // For IDEs we don't care for errors outside of the currently edited
          // query, so we return an empty array here.
          return [];
        }

        // Check if there are custom validation rules to be used
        const customRules: ValidationRule[] = [];
        // if (
        //   extensions?.customValidationRules &&
        //   typeof extensions.customValidationRules === "function"
        // ) {
        //   customRules = extensions.customValidationRules(this._graphQLConfig);

        //   /* eslint-enable no-implicit-coercion */
        // }

        if (!schema) {
          return [];
        }

        return validateQuery(
          validationAst,
          schema,
          customRules as ValidationRule[],
          isRelayCompatMode
        );
      };

      const schema = this._schema;

      await Promise.all(
        contents.map(async ({ query, range }) => {
          // const results = await getDiagnostics(
          //   query,
          //   uri,
          //   false // this._isRelayCompatMode(query)
          // );
          const results = getDiagnostics(
            //cachedDocument.contents[0].query, // BUG! [0]
            query,
            schema
          );
          if (results && results.length > 0) {
            diagnostics.push(
              ...processDiagnosticsMessage(results, query, range)
            );
          }
        })
      );

      this._logger.log(
        JSON.stringify({
          type: "usage",
          messageType: "textDocument/didChange",
          // projectName: project?.name,
          fileName: uri,
        })
      );

      return JSON.parse(JSON.stringify({ uri, diagnostics }));
    } catch (err) {
      //  this._handleConfigError({ err, uri });
      return { uri, diagnostics: [] };
    }
  }

  async handleHoverRequest(params: TextDocumentPositionParams): Promise<Hover> {
    if (
      !this._isInitialized
      // || !this._graphQLCache
    ) {
      return { contents: [] };
    }

    this.validateDocumentAndPosition(params);

    const { textDocument, position } = params;

    const cachedDocument = this._getCachedDocument(textDocument.uri);
    if (!cachedDocument) {
      return { contents: [] };
    }

    const found = cachedDocument.contents.find((content) => {
      const currentRange = content.range;
      if (currentRange?.containsPosition(toPosition(position))) {
        return true;
      }
    });

    // If there is no GraphQL query in this file, return an empty result.
    if (!found) {
      return { contents: [] };
    }

    const { query, range } = found;

    if (range) {
      position.line -= range.start.line;
    }

    // // OLD
    // const result = await this._languageService.getHoverInformation(
    //   query,
    //   toPosition(position),
    //   textDocument.uri,
    //   { useMarkdown: true }
    // );

    // NEW
    const schema = this._schema;

    if (!schema) {
      return {
        contents: "",
      };
    }
    const result = getHoverInformation(
      schema,
      query,
      toPosition(position),
      undefined,
      { useMarkdown: true }
    );

    return {
      contents: result,
    };
  }

  async handleDidChangeConfiguration(
    _params: DidChangeConfigurationParams
  ): Promise<DidChangeConfigurationRegistrationOptions> {
    // await this._updateGraphQLConfig();
    this._logger.log(
      JSON.stringify({
        type: "usage",
        messageType: "workspace/didChangeConfiguration",
      })
    );
    return {};
  }

  async handleDidCloseNotification(
    params: DidCloseTextDocumentParams
  ): Promise<PublishDiagnosticsParams | null> {
    if (
      !this._isInitialized
      // || !this._graphQLCache
    ) {
      return null;
    }
    // For every `textDocument/didClose` event, delete the cached entry.
    // This is to keep a low memory usage && switch the source of truth to
    // the file on disk.
    if (!params?.textDocument) {
      throw new Error("`textDocument` is required.");
    }
    const { textDocument } = params;
    const { uri } = textDocument;

    if (this._textDocumentCache.has(uri)) {
      this._textDocumentCache.delete(uri);
    }
    // const project = this._graphQLCache.getProjectForFile(uri);

    this._logger.log(
      JSON.stringify({
        type: "usage",
        messageType: "textDocument/didClose",
        // projectName: project?.name,
        fileName: uri,
      })
    );

    console.log("Clearing the diagnostics!");
    // LSP Server should clear the diagnosics when the file is closed.
    const diagnostics: Diagnostic[] = [];
    return { uri, diagnostics };
  }

  async handleDefinitionRequest(
    params: TextDocumentPositionParams,
    _token?: CancellationToken
  ): Promise<Array<Location>> {
    if (
      !this._isInitialized
      // || !this._graphQLCache
    ) {
      return [];
    }

    if (!params?.textDocument || !params.position) {
      throw new Error("`textDocument` and `position` arguments are required.");
    }
    const { textDocument, position } = params;
    // const project = this._graphQLCache.getProjectForFile(textDocument.uri);
    // if (project) {
    //   await this._cacheSchemaFilesForProject(project);
    // }
    const cachedDocument = this._getCachedDocument(textDocument.uri);
    if (!cachedDocument) {
      return [];
    }

    const found = cachedDocument.contents.find((content) => {
      const currentRange = content.range;
      if (currentRange?.containsPosition(toPosition(position))) {
        return true;
      }
    });

    // If there is no GraphQL query in this file, return an empty result.
    if (!found) {
      return [];
    }

    const { query, range: parentRange } = found;
    if (parentRange) {
      position.line -= parentRange.start.line;
    }

    let result = null;

    // OLD
    try {
      result = await this._languageService.getDefinition(
        query,
        toPosition(position),
        textDocument.uri
      );
    } catch {
      // these thrown errors end up getting fired before the service is initialized, so lets cool down on that
    }

    // // NEW
    // try {
    //   result = await getDefinition(
    //     query,
    //     toPosition(position),
    //     textDocument.uri
    //   );
    // } catch {
    //   // these thrown errors end up getting fired before the service is initialized, so lets cool down on that
    // }

    const inlineFragments: string[] = [];
    try {
      visit(parse(query), {
        FragmentDefinition: (node: FragmentDefinitionNode) => {
          inlineFragments.push(node.name.value);
        },
      });
    } catch {
      console.log("Error!");
    }

    const formatted = result
      ? result.definitions.map((res) => {
          const defRange = res.range as Range;

          if (parentRange && res.name) {
            const isInline = inlineFragments.includes(res.name);
            const isEmbedded = DEFAULT_SUPPORTED_EXTENSIONS.includes(
              extname(textDocument.uri)
            );
            if (isInline && isEmbedded) {
              const vOffset = parentRange.start.line;
              defRange.setStart(
                (defRange.start.line += vOffset),
                defRange.start.character
              );
              defRange.setEnd(
                (defRange.end.line += vOffset),
                defRange.end.character
              );
            }
          }
          return {
            uri: res.path,
            range: defRange,
          } as Location;
        })
      : [];

    this._logger.log(
      JSON.stringify({
        type: "usage",
        messageType: "textDocument/definition",
        // projectName: project?.name,
        fileName: textDocument.uri,
      })
    );
    return formatted;
  }

  async handleDocumentSymbolRequest(
    params: DocumentSymbolParams
  ): Promise<Array<SymbolInformation>> {
    if (
      !this._isInitialized
      // || !this._graphQLCache
    ) {
      return [];
    }

    if (!params?.textDocument) {
      throw new Error("`textDocument` argument is required.");
    }

    const { textDocument } = params;
    const cachedDocument = this._getCachedDocument(textDocument.uri);
    if (!cachedDocument?.contents[0]) {
      return [];
    }

    // console.log(
    //   "SYMBOLS",
    //   await this._languageService.getDocumentSymbols(
    //     cachedDocument.contents[0].query,
    //     textDocument.uri
    //   )
    // );

    return this._languageService.getDocumentSymbols(
      cachedDocument.contents[0].query,
      textDocument.uri
    );
  }

  async handleWorkspaceSymbolRequest(
    params: WorkspaceSymbolParams
  ): Promise<Array<SymbolInformation>> {
    if (
      !this._isInitialized
      // || !this._graphQLCache
    ) {
      return [];
    }
    // const config = await this._graphQLCache.getGraphQLConfig();
    // await this._cacheAllProjectFiles(config);

    if (params.query !== "") {
      const documents = this._getTextDocuments();
      const symbols: SymbolInformation[] = [];
      await Promise.all(
        documents.map(async ([uri]) => {
          const cachedDocument = this._getCachedDocument(uri);
          if (!cachedDocument) {
            return [];
          }
          // console.log(
          //   "cachedDocument handleWorkspaceSymbolRequest",
          //   cachedDocument
          // );
          console.log("WORKSPACE!", cachedDocument.contents[0].query);
          const docSymbols = await this._languageService.getDocumentSymbols(
            cachedDocument.contents[0].query,
            uri
          );
          symbols.push(...docSymbols);
        })
      );
      return symbols.filter(
        (symbol) => symbol?.name && symbol.name.includes(params.query)
      );
    }

    return [];
  }

  async handleWatchedFilesChangedNotification(
    params: DidChangeWatchedFilesParams
  ): Promise<Array<PublishDiagnosticsParams | undefined> | null> {
    if (
      this._isGraphQLConfigMissing ||
      !this._isInitialized
      // ||
      // !this._graphQLCache
    ) {
      return null;
    }

    return null;
    // return Promise.all(
    //   params.changes.map(async (change: FileEvent) => {
    //     if (
    //       this._isGraphQLConfigMissing ||
    //       !this._isInitialized ||
    //       // !this._graphQLCache
    //     ) {
    //       this._logger.warn('No cache available for handleWatchedFilesChanged');
    //       return;
    //     }
    //     if (
    //       change.type === FileChangeTypeKind.Created ||
    //       change.type === FileChangeTypeKind.Changed
    //     ) {
    //       const { uri } = change;

    //       const text = readFileSync(URI.parse(uri).fsPath, 'utf-8');
    //       const contents = this._parser(text, uri);

    //       await this._updateFragmentDefinition(uri, contents);
    //       await this._updateObjectTypeDefinition(uri, contents);

    //       const project = this._graphQLCache.getProjectForFile(uri);
    //       let diagnostics: Diagnostic[] = [];

    //       if (
    //         project?.extensions?.languageService?.enableValidation !== false
    //       ) {
    //         diagnostics = (
    //           await Promise.all(
    //             contents.map(async ({ query, range }) => {
    //               const results = await this._languageService.getDiagnostics(
    //                 query,
    //                 uri,
    //                 this._isRelayCompatMode(query),
    //               );
    //               if (results && results.length > 0) {
    //                 return processDiagnosticsMessage(results, query, range);
    //               }
    //               return [];
    //             }),
    //           )
    //         ).reduce((left, right) => left.concat(right), diagnostics);
    //       }

    //       this._logger.log(
    //         JSON.stringify({
    //           type: 'usage',
    //           messageType: 'workspace/didChangeWatchedFiles',
    //           projectName: project?.name,
    //           fileName: uri,
    //         }),
    //       );
    //       return { uri, diagnostics };
    //     }
    //     if (change.type === FileChangeTypeKind.Deleted) {
    //       await this._graphQLCache.updateFragmentDefinitionCache(
    //         this._graphQLCache.getGraphQLConfig().dirpath,
    //         change.uri,
    //         false,
    //       );
    //       await this._graphQLCache.updateObjectTypeDefinitionCache(
    //         this._graphQLCache.getGraphQLConfig().dirpath,
    //         change.uri,
    //         false,
    //       );
    //     }
    //   }),
    // );
  }

  _getTextDocuments() {
    return Array.from(this._textDocumentCache);
  }

  handleShutdownRequest(): void {
    // console.log("handleShutdownRequest", this._willShutdown);
    this._willShutdown = true;
    // console.log("handleShutdownRequest", this._willShutdown);
  }

  handleExitNotification(): void {
    // process.exit(this._willShutdown ? 0 : 1);
    // console.log("handleExitNotification", this._willShutdown ? 0 : 1);
  }

  validateDocumentAndPosition(params: CompletionParams): void {
    if (!params?.textDocument?.uri || !params.position) {
      throw new Error(
        "`textDocument.uri` and `position` arguments are required."
      );
    }
  }

  async _updateGraphQLConfig() {
    const settings = await this._connection.workspace.getConfiguration({
      section: "graphql-config",
    });
    const vscodeSettings = await this._connection.workspace.getConfiguration({
      section: "vscode-graphql",
    });

    this._settings = { ...settings, ...vscodeSettings };

    // console.log(this._settings, "SETTINGS!");

    //   try {
    //     // reload the graphql cache
    //     this._graphQLCache = await getGraphQLCache({
    //       parser: this._parser,
    //       loadConfigOptions: this._loadConfigOptions,
    //       logger: this._logger,
    //     });
    //     this._languageService = new GraphQLLanguageService(
    //       this._graphQLCache,
    //       this._logger
    //     );
    //     if (this._graphQLConfig || this._graphQLCache?.getGraphQLConfig) {
    //       const config =
    //         this._graphQLConfig ?? this._graphQLCache.getGraphQLConfig();
    //       //await this._cacheAllProjectFiles(config);
    //     }
    //     this._isInitialized = true;
    //   } catch (err) {
    //     //  this._handleConfigError({ err });
    //   }
  }
  // _handleConfigError({ err }: { err: unknown; uri?: string }) {
  //   if (err instanceof ConfigNotFoundError || err instanceof ConfigEmptyError) {
  //     // TODO: obviously this needs to become a map by workspace from uri
  //     // for workspaces support
  //     this._isGraphQLConfigMissing = true;
  //     this._logConfigError(err.message);
  //   } else if (err instanceof ProjectNotFoundError) {
  //     // this is the only case where we don't invalidate config;
  //     // TODO: per-project schema initialization status (PR is almost ready)
  //     this._logConfigError(
  //       "Project not found for this file - make sure that a schema is present"
  //     );
  //   } else if (err instanceof ConfigInvalidError) {
  //     this._isGraphQLConfigMissing = true;
  //     this._logConfigError(`Invalid configuration\n${err.message}`);
  //   } else if (err instanceof LoaderNoResultError) {
  //     this._isGraphQLConfigMissing = true;
  //     this._logConfigError(err.message);
  //     return;
  //   } else {
  //     // if it's another kind of error,
  //     // lets just assume the config is missing and
  //     // disable language features
  //     this._isGraphQLConfigMissing = true;
  //     this._logConfigError(
  //       // @ts-expect-error
  //       err?.message ?? err?.toString()
  //     );
  //   }
  // }
  /*
    Method that returns in memory _textDocumentCache for specific uri.
  */
  _getCachedDocument(uri: string): CachedDocumentType | null {
    if (this._textDocumentCache.has(uri)) {
      const cachedDocument = this._textDocumentCache.get(uri);
      if (cachedDocument) {
        return cachedDocument;
      }
    }
    return null;
  }
  /*
    Method that invalidates in memory _textDocumentCache for specific uri.
  */
  async _invalidateCache(
    textDocument: VersionedTextDocumentIdentifier,
    uri: Uri,
    contents: CachedContent[]
  ): Promise<Map<string, CachedDocumentType> | null> {
    if (this._textDocumentCache.has(uri)) {
      const cachedDocument = this._textDocumentCache.get(uri);
      if (
        cachedDocument &&
        textDocument &&
        textDocument?.version &&
        cachedDocument.version < textDocument.version
      ) {
        // Current server capabilities specify the full sync of the contents.
        // Therefore always overwrite the entire content.
        return this._textDocumentCache.set(uri, {
          version: textDocument.version,
          contents,
        });
      }
    }
    return this._textDocumentCache.set(uri, {
      version: textDocument.version ?? 0,
      contents,
    });
  }
}

// --------------------------------------------------------------------------------

function processDiagnosticsMessage(
  results: Diagnostic[],
  query: string,
  range: RangeType | null
): Diagnostic[] {
  const queryLines = query.split("\n");
  const totalLines = queryLines.length;
  const lastLineLength = queryLines[totalLines - 1].length;
  const lastCharacterPosition = new Position(totalLines, lastLineLength);
  const processedResults = results.filter((diagnostic) =>
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    diagnostic.range.end.lessThanOrEqualTo(lastCharacterPosition)
  );

  if (range) {
    const offset = range.start;
    return processedResults.map((diagnostic) => ({
      ...diagnostic,
      range: new Range(
        new Position(
          diagnostic.range.start.line + offset.line,
          diagnostic.range.start.character
        ),
        new Position(
          diagnostic.range.end.line + offset.line,
          diagnostic.range.end.character
        )
      ),
    }));
  }

  return processedResults;
}
