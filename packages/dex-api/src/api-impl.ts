import { join } from "path";
import assert from "assert";
import { format } from "util";
import type { XiorInstance, XiorResponse } from "xior";

export abstract class ApiImpl {
  protected abstract path?: string;

  constructor(protected readonly xior: XiorInstance) {}

  protected buildPath(...path: (string | number)[]) {
    assert(this.path, "path not override");

    return join(
      this.path,
      path.map(String).reduce((a, b) => join(a, b)),
    );
  }

  protected buildPathWithQueryString(
    path: string,
    query?: Record<string, string | boolean | number | string[]>,
  ) {
    let encodedQuery: Record<string, string> | undefined;

    if (query)
      encodedQuery = Object.fromEntries(
        Object.entries(query).map(([key, value]) => {
          if (Array.isArray(value)) return [key, value.join(",")];
          else return [key, value.toString()];
        }),
      );
    const q = new URLSearchParams(encodedQuery);
    return format("%s?%s", path, q.toString());
  }

  static async getData<T extends object | number | string>(
    response: Promise<XiorResponse<T>>,
  ) {
    const { data } = await response;
    return data;
  }
}
