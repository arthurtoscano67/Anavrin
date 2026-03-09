import { useQuery } from "@tanstack/react-query";
import { useSuiClient } from "@mysten/dapp-kit";

import {
  readAdminCapOwner,
  readMintConfig,
} from "../services/AvatarMintService";
import { resolveActiveIdentity, readOwnedAvatars } from "../services/InventoryService";

export function useAnavrinMintConfig() {
  const client = useSuiClient();

  return useQuery({
    queryKey: ["anavrin", "mint-config"],
    queryFn: () => readMintConfig(client),
    staleTime: 10_000,
  });
}

export function useAnavrinAdminOwner() {
  const client = useSuiClient();

  return useQuery({
    queryKey: ["anavrin", "admin-owner"],
    queryFn: () => readAdminCapOwner(client),
    staleTime: 30_000,
  });
}

export function useAnavrinActiveIdentity(address: string | null) {
  const client = useSuiClient();

  return useQuery({
    queryKey: ["anavrin", "identity", address],
    queryFn: () => {
      if (!address) return Promise.resolve(null);
      return resolveActiveIdentity(client, address);
    },
    enabled: Boolean(address),
    staleTime: 10_000,
  });
}

export function useAnavrinOwnedAvatars(address: string | null) {
  const client = useSuiClient();

  return useQuery({
    queryKey: ["anavrin", "owned-avatars", address],
    queryFn: () => {
      if (!address) return Promise.resolve([]);
      return readOwnedAvatars(client, address);
    },
    enabled: Boolean(address),
    staleTime: 10_000,
  });
}
