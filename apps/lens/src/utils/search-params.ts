import { ReadonlyURLSearchParams } from "next/navigation";

export const searchParamsToJSON = (
  searchParams: ReadonlyURLSearchParams | Record<string, string>,
) => {
  const query: Record<string, string> = {};
  if (searchParams instanceof ReadonlyURLSearchParams)
    for (const [key, value] of searchParams.entries()) query[key] = value;
  else
    for (const [key, value] of Object.entries(searchParams)) query[key] = value;
  return query;
};
