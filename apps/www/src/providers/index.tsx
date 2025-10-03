"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { trpcClient } from "../trpc.server";
import { TRPCProvider } from "../trpc.client";

const queryClient = new QueryClient();

export default function Provider({ children }: React.PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <TRPCProvider
        trpcClient={trpcClient}
        queryClient={queryClient}
      >
        {children}
      </TRPCProvider>
    </QueryClientProvider>
  );
}
