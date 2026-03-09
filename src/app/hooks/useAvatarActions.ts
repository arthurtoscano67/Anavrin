import { useCallback, useState } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";

import { useTxExecutor } from "./useTxExecutor";
import { buildPauseMintTx, buildResumeMintTx, buildSetMintPriceTx } from "../lib/avatarTransactions";

type PendingAction = "pause" | "resume" | "set-price" | null;

export function useAvatarActions() {
  const account = useCurrentAccount();
  const { execute } = useTxExecutor();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  const requireWallet = useCallback(() => {
    if (!account) throw new Error("Connect wallet first.");
  }, [account]);

  const pauseMint = useCallback(async () => {
    requireWallet();
    setPendingAction("pause");
    try {
      await execute(buildPauseMintTx(), "Mint paused");
    } finally {
      setPendingAction(null);
    }
  }, [execute, requireWallet]);

  const resumeMint = useCallback(async () => {
    requireWallet();
    setPendingAction("resume");
    try {
      await execute(buildResumeMintTx(), "Mint resumed");
    } finally {
      setPendingAction(null);
    }
  }, [execute, requireWallet]);

  const setMintPrice = useCallback(
    async (newPriceMist: string) => {
      requireWallet();
      setPendingAction("set-price");
      try {
        await execute(buildSetMintPriceTx(newPriceMist), "Mint price updated");
      } finally {
        setPendingAction(null);
      }
    },
    [execute, requireWallet]
  );

  return {
    pendingAction,
    pauseMint,
    resumeMint,
    setMintPrice,
  };
}
