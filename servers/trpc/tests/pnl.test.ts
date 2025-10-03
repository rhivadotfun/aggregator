import { web3 } from "@coral-xyz/anchor";
import { beforeAll, describe, test } from "bun:test";

import { getEnv } from "../src/env";
import { getSarosPNL } from "../src/utils/pnl";
import { coingecko, solanatracker } from "../src/instances";

describe("utils.pnl", () => {
  let connection: web3.Connection;

  beforeAll(() => {
    connection = new web3.Connection(getEnv("RPC_URL"));
  });

  test("getPNL", async () => {
    console.log(
      await getSarosPNL(
        connection,
        coingecko,
        solanatracker,
        "5yVP6HMhhsqR2LgvjKfd6pPywadX5XFQ65UnadHvnX7X6HBK2caJkBKLWiN5oUgFBFtmSa6khrZFxGnwsEJ8zua3",
      ),
    );
  });
});
