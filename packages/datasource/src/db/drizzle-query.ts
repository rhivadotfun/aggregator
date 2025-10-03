import { format } from "util";
import {
  and,
  arrayContained,
  arrayContains,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  like,
  lt,
  lte,
  not,
  notInArray,
  or,
  sql,
  type SQL,
  type SQLWrapper,
} from "drizzle-orm";

import type { Operator, OrderByOperator, Value } from "./zod-query";

export const mapOperators = {
  eq,
  gt,
  lt,
  gte,
  lte,
  like,
  ilike,
};

const arrayOperators = {
  inArray,
  notInArray,
  arrayContained,
  arrayContains,
};

const nestedOperators = {
  and,
  or,
};

const conditionalOperators = {
  ne: not,
  isNotNull,
  isNull,
};

export class FilterSchemaError extends Error {}

export const buildDrizzleWhereClauseFromObject = <
  T extends { [key: string]: Operator<Value> },
>(
  value: T,
) => {
  const query: (SQL<unknown> | undefined)[] = [];

  const getFilters = <T>(name: SQL<unknown>, operator: Operator<Value>) => {
    const query: T[] = [];

    for (const [opName, value] of Object.entries(operator)) {
      if (Array.isArray(value)) {
        if (opName in nestedOperators) {
          const op = nestedOperators[opName as keyof typeof nestedOperators];
          const clauses = [];
          for (const innerOperator of value) {
            clauses.push(
              ...getFilters<SQL<unknown> | undefined>(name, innerOperator),
            );
          }

          query.push(op(...clauses) as T);
          continue;
        } else if (opName in arrayOperators) {
          const op = arrayOperators[opName as keyof typeof arrayOperators];
          // @ts-expect-error method param not checked
          query.push(op(name, value) as T);
          continue;
        } else
          throw new FilterSchemaError(format("invalid op %s format", opName));
      } else if (value instanceof Object) {
        if (opName in conditionalOperators) {
          const op =
            conditionalOperators[opName as keyof typeof conditionalOperators];
          if (value) {
            const [clause] = getFilters<SQLWrapper>(name, value);
            query.push(op(clause) as T);
            continue;
          } else {
            query.push(op(name) as T);
            continue;
          }
        }
      }

      if (opName in mapOperators) {
        const op = mapOperators[opName as keyof typeof mapOperators];
        query.push(op(name, value) as T);
      } else throw new FilterSchemaError(format("op %s not supported", opName));
    }
    return query;
  };

  for (const [name, operator] of Object.entries(value))
    query.push(
      ...getFilters<SQL<unknown>>(sql.raw(format('"%s"', name)), operator),
    );

  return query;
};

const mapOrderByOperators = { desc, asc };

export const buildOrderByClauseFromObject = <
  T extends OrderByOperator | string[],
>(
  orderBy: T,
) => {
  const query: SQL<unknown>[] = [];
  if (Array.isArray(orderBy))
    return orderBy.map((value) => desc(sql.raw(format('"%s"', value))));

  for (const [value, opName] of Object.entries(orderBy)) {
    if (opName in mapOrderByOperators) {
      const op =
        mapOrderByOperators[opName as keyof typeof mapOrderByOperators];
      query.push(op(sql.raw(format('"%s"', value))));
    } else
      throw new FilterSchemaError(format("op %s is not supported", opName));
  }

  return query;
};
