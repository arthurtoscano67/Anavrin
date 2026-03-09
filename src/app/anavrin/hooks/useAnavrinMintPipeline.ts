import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSuiClient } from "@mysten/dapp-kit";
import { toast } from "sonner";

import { useTxExecutor } from "../../hooks/useTxExecutor";
import { ANAVRIN_TYPES } from "../config/anavrinConfig";
import { buildMintAvatarTransaction, readAvatarIdentity } from "../services/AvatarMintService";
import { setStoredActiveIdentityId } from "../services/InventoryService";
import {
  executeZkLoginTransaction,
  extractCreatedObjectId,
  formatSuiTransactionError,
} from "../services/SuiTransactionService";
import { useAuthManager } from "../services/AuthManager";
import type { ActiveIdentity, AvatarDraft } from "../types";

type MintPipelineState =
  | "idle"
  | "building"
  | "signing"
  | "confirming"
  | "spawned";

export function useAnavrinMintPipeline() {
  const client = useSuiClient();
  const queryClient = useQueryClient();
  const { executeAndFetchBlock } = useTxExecutor();
  const auth = useAuthManager();
  const [pipelineState, setPipelineState] = useState<MintPipelineState>("idle");
  const [latestIdentity, setLatestIdentity] = useState<ActiveIdentity | null>(null);

  useEffect(() => {
    setLatestIdentity(null);
  }, [auth.activeAddress]);

  const mintAvatar = useCallback(
    async (draft: AvatarDraft) => {
      if (!auth.activeAddress) {
        throw new Error("Connect a wallet or complete zkLogin first.");
      }

      const { transaction } = buildMintAvatarTransaction(draft);
      setPipelineState("building");

      try {
        setPipelineState("signing");
        let response:
          | Awaited<ReturnType<typeof executeZkLoginTransaction>>["response"]
          | Awaited<ReturnType<typeof executeAndFetchBlock>>["block"];

        if (auth.authMethod === "zklogin") {
          if (!auth.zkLoginSession) {
            throw new Error("zkLogin session missing.");
          }

          const toastId = toast.loading("Generating zkLogin proof...");
          try {
            const result = await executeZkLoginTransaction({
              client,
              transaction,
              session: auth.zkLoginSession,
            });
            response = result.response;
            toast.success("Avatar mint submitted", { id: toastId });
          } catch (error) {
            toast.error(formatSuiTransactionError(error), { id: toastId });
            throw error;
          }
        } else {
          const walletResult = await executeAndFetchBlock(
            transaction,
            "Avatar minted on Sui mainnet"
          );
          response = walletResult.block;
        }

        setPipelineState("confirming");
        const objectId = extractCreatedObjectId(response, ANAVRIN_TYPES.avatar);

        if (!objectId) {
          throw new Error("Mint confirmed, but the avatar object was not found.");
        }

        const identity = await readAvatarIdentity(client, objectId);
        setStoredActiveIdentityId(auth.activeAddress, objectId);
        setLatestIdentity(identity);
        setPipelineState("spawned");
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ["anavrin", "identity"] }),
          queryClient.invalidateQueries({ queryKey: ["anavrin", "owned-avatars"] }),
          queryClient.invalidateQueries({ queryKey: ["anavrin", "mint-config"] }),
        ]);

        toast.success("Avatar identity set. Spawning into NYC.");
        return identity;
      } catch (error) {
        setPipelineState("idle");
        throw error;
      }
    },
    [auth, client, executeAndFetchBlock, queryClient]
  );

  return {
    auth,
    pipelineState,
    latestIdentity,
    mintAvatar,
  };
}
