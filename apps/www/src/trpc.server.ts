import superjson from "superjson";
import type { AppRouter } from "@rhiva-ag/trpc";
import { createTRPCClient, httpBatchLink } from "@trpc/client";

export const trpcClient = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: process.env.NEXT_PUBLIC_API_URL!,
      transformer: superjson,
    }),
  ],
});
