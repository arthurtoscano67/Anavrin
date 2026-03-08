import { useQuery } from "@tanstack/react-query";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";

import { fetchAvatarAdminState, fetchAvatarMintConfig } from "../lib/avatarClient";

export function useAvatarMintConfig() {
  const client = useSuiClient();

  return useQuery({
    queryKey: ["avatar", "mint-config"],
    queryFn: () => fetchAvatarMintConfig(client),
    staleTime: 10_000,
  });
}

export function useAvatarAdminState() {
  const client = useSuiClient();
  const account = useCurrentAccount();

  return useQuery({
    queryKey: ["avatar", "admin-state", account?.address ?? null],
    queryFn: () => fetchAvatarAdminState(client, account?.address),
    staleTime: 10_000,
  });
}
