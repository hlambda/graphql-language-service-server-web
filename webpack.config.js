/* eslint-disable no-undef */
/* eslint-disable @typescript-eslint/no-var-requires */
/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

//@ts-check
"use strict";

//@ts-check
/** @typedef {import('webpack').Configuration} WebpackConfig **/

const path = require("path");
const webpack = require("webpack");

/** @type WebpackConfig */
const browserClientConfig = {
  context: path.join(__dirname, "client"),
  mode: "none",
  target: "webworker", // web extensions run in a webworker context
  entry: {
    browserClientMain: "./src/browserClientMain.ts",
  },
  output: {
    filename: "[name].js",
    path: path.join(__dirname, "client", "dist"),
    libraryTarget: "commonjs",
  },
  resolve: {
    mainFields: ["module", "main"],
    extensions: [".ts", ".js"], // support ts-files and js-files
    alias: {},
    fallback: {
      path: require.resolve("path-browserify"),
    },
  },
  // We need to use this because of graphql-js even for client (execute gql)
  plugins: [
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV), // Important to webworkify graphql-js https://github.com/graphql/graphql-js
    }),
  ],
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
          },
        ],
      },
    ],
  },
  externals: {
    vscode: "commonjs vscode", // ignored because it doesn't exist
  },
  performance: {
    hints: false,
  },
  devtool: "source-map",
};

/** @type WebpackConfig */
const browserServerConfig = {
  context: path.join(__dirname, "server"),
  mode: "none",
  target: "webworker", // web extensions run in a webworker context
  entry: {
    browserServerMain: "./src/browserServerMain.ts",
  },
  output: {
    filename: "[name].js",
    path: path.join(__dirname, "server", "dist"),
    libraryTarget: "var",
    library: "serverExportVar",
  },
  resolve: {
    mainFields: ["module", "main"],
    extensions: [".ts", ".js"], // support ts-files and js-files
    alias: {},
    fallback: {
      path: require.resolve("path-browserify"),
      // util: require.resolve("util"),
      // url: require.resolve("url"),
      // assert: require.resolve("assert"),
      // stream: require.resolve("stream-browserify"),
    },
  },
  plugins: [
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV), // Important to webworkify graphql-js https://github.com/graphql/graphql-js
      // 'process.env.HOST': JSON.stringify(process.env.HOST),
      // 'process.CUSTOM': JSON.stringify({ a: 0, b: [1, 2, 3] }), // just an example
    }),
  ],
  module: {
    rules: [
      {
        test: /\.ts$/,
        exclude: /node_modules/,
        use: [
          {
            loader: "ts-loader",
          },
        ],
      },
    ],
  },
  externals: {
    vscode: "commonjs vscode", // ignored because it doesn't exist
  },
  performance: {
    hints: false,
  },
  devtool: "source-map",
};

module.exports = [browserClientConfig, browserServerConfig];
