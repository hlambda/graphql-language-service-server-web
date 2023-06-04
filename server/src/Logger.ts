import { Logger as VSCodeLogger } from "vscode-jsonrpc";
import { Connection } from "vscode-languageserver";

export class Logger implements VSCodeLogger {
  constructor(private _connection: Connection) {}

  error(message: string): void {
    // console.error(message);
    this._connection.console.error(message);
  }

  warn(message: string): void {
    // console.warn(message);
    this._connection.console.warn(message);
  }

  info(message: string): void {
    // console.info(message);
    this._connection.console.info(message);
  }

  log(message: string): void {
    // console.log(message);
    this._connection.console.log(message);
  }
}

export class ConsoleLogger implements VSCodeLogger {
  error(message: string): void {
    console.error(message);
  }

  warn(message: string): void {
    console.warn(message);
  }

  info(message: string): void {
    console.info(message);
  }

  log(message: string): void {
    console.log(message);
  }
}
export class NoopLogger implements VSCodeLogger {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  error() {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  warn() {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  info() {}
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  log() {}
}
