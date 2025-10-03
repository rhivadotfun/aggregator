import chunk from "lodash.chunk";

export const collectMap = <
  T extends Array<unknown>,
  Fn extends (item: T[number], index: number) => unknown | null,
>(
  collection: T,
  mapFn: Fn,
) => {
  const results = [];
  for (const [index, item] of collection.entries()) {
    const result = mapFn(item, index);
    if (result) results.push(result);
  }

  return results as NonNullable<ReturnType<Fn>>[];
};

export const collectionToMap = <
  T extends Array<unknown>,
  Fn extends (item: T[number], index: number) => unknown | null,
>(
  collection: T,
  getId: Fn,
) => {
  const result = new Map<NonNullable<ReturnType<Fn>>, NonNullable<T[number]>>();
  for (const [index, item] of collection.entries()) {
    const id = getId(item, index);
    if (id)
      result.set(
        id as NonNullable<ReturnType<Fn>>,
        item as NonNullable<T[number]>,
      );
  }

  return result;
};

export function chunkFetchMultiple<
  T extends (chunkable: any[], ...options: any[]) => Promise<any>,
>(fn: T, maxPerRequest: number) {
  return async (...[chunkable, ...options]: Parameters<T>) => {
    const chunks = chunk(chunkable, maxPerRequest);
    return (
      await Promise.all(chunks.map((chunk) => fn(chunk, ...options)))
    ).flat() as ReturnType<T>;
  };
}
