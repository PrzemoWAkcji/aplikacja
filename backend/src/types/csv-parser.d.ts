declare module 'csv-parser' {
  import { Transform } from 'stream';

  interface Options {
    separator?: string;
    quote?: string;
    escape?: string;
    headers?: boolean | string[] | ((headers: string[]) => string[]);
    strict?: boolean;
    skipLines?: number;
    skipComments?: boolean | string;
  }

  function csvParser(options?: Options): Transform;

  export = csvParser;
}
