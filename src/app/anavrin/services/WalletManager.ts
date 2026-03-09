import { useCallback, useMemo } from "react";
import {
  useConnectWallet,
  useCurrentAccount,
  useCurrentWallet,
  useDisconnectWallet,
  useWallets,
} from "@mysten/dapp-kit";
import { toast } from "sonner";

import type { WalletDirectoryEntry } from "../types";

const PREFERRED_WALLETS = ["Slush", "Suiet", "Ethos Wallet"] as const;

export function useWalletManager() {
  const wallets = useWallets();
  const account = useCurrentAccount();
  const currentWallet = useCurrentWallet();
  const connectWallet = useConnectWallet();
  const disconnectWallet = useDisconnectWallet();

  const directory = useMemo<WalletDirectoryEntry[]>(
    () =>
      PREFERRED_WALLETS.map((name) => ({
        name,
        installed: wallets.some((wallet) => wallet.name === name),
        matchesPreferred: true,
      })),
    [wallets]
  );

  const walletName = currentWallet.currentWallet?.name ?? null;

  const connectByName = useCallback(
    async (walletNameToConnect: string) => {
      const wallet = wallets.find((candidate) => candidate.name === walletNameToConnect);
      if (!wallet) {
        throw new Error(`${walletNameToConnect} is not available in this browser.`);
      }

      await connectWallet.mutateAsync({ wallet });
      toast.success(`${walletNameToConnect} connected`);
    },
    [connectWallet, wallets]
  );

  const disconnect = useCallback(async () => {
    await disconnectWallet.mutateAsync();
    toast.success("Wallet disconnected");
  }, [disconnectWallet]);

  return {
    wallets,
    directory,
    walletName,
    address: account?.address ?? null,
    isConnecting: currentWallet.isConnecting || connectWallet.isPending,
    isConnected: currentWallet.isConnected,
    canSignTransactions: currentWallet.isConnected,
    connectByName,
    disconnect,
  };
}
