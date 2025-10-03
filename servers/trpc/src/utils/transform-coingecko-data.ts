import type { MegafilterGetResponse } from "@coingecko/coingecko-typescript/resources/onchain/pools.js";
import type { PoolGetAddressResponse } from "@coingecko/coingecko-typescript/resources/onchain/networks.js";
import type { MultiGetAddressesResponse } from "@coingecko/coingecko-typescript/resources/onchain/networks/pools/multi.js";

type NonNullable<T extends object | undefined> = { [key in keyof T]-?: T[key] };

export const transformCoingeckoPool = ({
  data,
  included,
}: PoolGetAddressResponse) => {
  const mapIncluded: Record<
    string,
    NonNullable<MegafilterGetResponse.Included["attributes"]>
  > = Object.fromEntries(
    (included ? included : []).map((include) => [
      include.id,
      include.attributes,
    ]),
  );

  const relationships = data!
    .relationships as NonNullable<MegafilterGetResponse.Data.Relationships>;
  const base_token = relationships.base_token
    .data as NonNullable<MegafilterGetResponse.Data.Relationships.BaseToken.Data>;
  const quote_token = relationships.quote_token
    .data as NonNullable<MegafilterGetResponse.Data.Relationships.BaseToken.Data>;
  const resolved_base_token = mapIncluded[base_token.id];
  const resolved_quote_token = mapIncluded[quote_token.id];

  return {
    ...data!.attributes!,
    resolved_base_token,
    resolved_quote_token,
  } as NonNullable<PoolGetAddressResponse.Data["attributes"]> & {
    id: string;
    resolved_base_token: NonNullable<PoolGetAddressResponse.Included.Attributes>;
    resolved_quote_token: NonNullable<PoolGetAddressResponse.Included.Attributes>;
  };
};

export const transformCoingeckoPools = (
  ...responses: MultiGetAddressesResponse[]
) => {
  return responses.flatMap((response) => {
    const { included, data } = response;
    const mapIncluded: Record<
      string,
      NonNullable<MegafilterGetResponse.Included["attributes"]>
    > = Object.fromEntries(
      (included ? included : []).map((include) => [
        include.id,
        include.attributes,
      ]),
    );

    return data!.map((pool) => {
      const relationships = pool!
        .relationships as NonNullable<MegafilterGetResponse.Data.Relationships>;
      const base_token = relationships.base_token
        .data as NonNullable<MegafilterGetResponse.Data.Relationships.BaseToken.Data>;
      const quote_token = relationships.quote_token
        .data as NonNullable<MegafilterGetResponse.Data.Relationships.QuoteToken.Data>;
      const resolved_base_token = mapIncluded[base_token.id];
      const resolved_quote_token = mapIncluded[quote_token.id];

      return {
        ...pool!.attributes!,
        resolved_base_token,
        resolved_quote_token,
      } as NonNullable<PoolGetAddressResponse.Data["attributes"]> & {
        id: string;
        resolved_base_token?: NonNullable<PoolGetAddressResponse.Included.Attributes>;
        resolved_quote_token?: NonNullable<PoolGetAddressResponse.Included.Attributes>;
      };
    });
  });
};
