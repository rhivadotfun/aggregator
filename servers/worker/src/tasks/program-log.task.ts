import { Queue } from "bullmq";
import type { web3 } from "@coral-xyz/anchor";

import { connection, logger, redis } from "../instances";

const queue = new Queue("programLog", {
  connection: redis.options,
  defaultJobOptions: { removeOnComplete: true, removeOnFail: false },
});

export const runProgramLogTask = (programs: web3.PublicKey[]) => {
  const subscriptions: number[] = [];

  for (const program of programs) {
    const subscription = connection.onLogs(program, (log) => {
      logger.info(
        { signature: log.signature, program: program.toBase58() },
        "program.onLogs",
      );
      if (log.err) return;
      return queue.add("processLog", log.signature, {
        jobId: log.signature,
        deduplication: { id: log.signature },
      });
    });

    subscriptions.push(subscription);
  }

  return async () =>
    Promise.allSettled([
      queue.close(),
      subscriptions.filter(Boolean).forEach(connection.removeOnLogsListener),
    ]);
};
