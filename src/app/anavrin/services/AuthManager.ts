import { useCallback, useEffect, useMemo, useState } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  generateNonce,
  generateRandomness,
  getExtendedEphemeralPublicKey,
  jwtToAddress,
} from "@mysten/sui/zklogin";
import { toast } from "sonner";

import {
  ANAVRIN_CONFIG,
  ANAVRIN_ZKLOGIN_GOOGLE,
} from "../config/anavrinConfig";
import type {
  AuthMethod,
  ZkLoginPendingSession,
  ZkLoginProofEnvelope,
  ZkLoginSession,
} from "../types";
import { useWalletManager } from "./WalletManager";

function readStorage<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeStorage<T>(key: string, value: T | null) {
  if (typeof window === "undefined") return;
  if (value === null) {
    window.sessionStorage.removeItem(key);
    return;
  }
  window.sessionStorage.setItem(key, JSON.stringify(value));
}

function buildGoogleAuthUrl(nonce: string) {
  const callback = new URL(
    ANAVRIN_CONFIG.zkLogin.callbackPath,
    window.location.origin
  );
  const url = new URL(ANAVRIN_ZKLOGIN_GOOGLE.authUrl);
  url.searchParams.set(
    "client_id",
    ANAVRIN_CONFIG.zkLogin.googleClientId
  );
  url.searchParams.set("redirect_uri", callback.toString());
  url.searchParams.set("response_type", "id_token");
  url.searchParams.set("scope", ANAVRIN_ZKLOGIN_GOOGLE.scopes.join(" "));
  url.searchParams.set("nonce", nonce);
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

function parseHashParams(hash: string) {
  const source = hash.startsWith("#") ? hash.slice(1) : hash;
  return new URLSearchParams(source);
}

async function fetchUserSalt(jwt: string): Promise<string> {
  const url = ANAVRIN_CONFIG.zkLogin.saltServiceUrl;
  if (!url) {
    throw new Error("Missing VITE_ANAVRIN_ZKLOGIN_SALT_URL.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jwt }),
  });

  if (!response.ok) {
    throw new Error("Salt service rejected zkLogin request.");
  }

  const data = (await response.json()) as {
    userSalt?: string;
    salt?: string;
  };

  const salt = data.userSalt ?? data.salt;
  if (!salt) {
    throw new Error("Salt service did not return a user salt.");
  }

  return salt;
}

async function fetchProofEnvelope(
  jwt: string,
  pending: ZkLoginPendingSession
): Promise<ZkLoginProofEnvelope | undefined> {
  const url = ANAVRIN_CONFIG.zkLogin.proofServiceUrl;
  if (!url) return undefined;

  const keypair = Ed25519Keypair.fromSecretKey(pending.ephemeralSecretKey);
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jwt,
      maxEpoch: pending.maxEpoch,
      jwtRandomness: pending.randomness,
      extendedEphemeralPublicKey: getExtendedEphemeralPublicKey(
        keypair.getPublicKey()
      ),
      keyClaimName: "sub",
    }),
  });

  if (!response.ok) {
    throw new Error("Proof service rejected zkLogin proof generation.");
  }

  const data = (await response.json()) as {
    proof?: ZkLoginProofEnvelope;
    inputs?: ZkLoginProofEnvelope;
  };

  return data.proof ?? data.inputs;
}

export function useAuthManager() {
  const client = useSuiClient();
  const wallet = useWalletManager();
  const [preferredAuthMethod, setPreferredAuthMethod] = useState<AuthMethod>(
    null
  );
  const [zkLoginSession, setZkLoginSession] = useState<ZkLoginSession | null>(
    () => readStorage<ZkLoginSession>(ANAVRIN_CONFIG.storageKeys.zkSession)
  );
  const [isProcessingZkLogin, setIsProcessingZkLogin] = useState(false);

  const zkLoginEnabled = Boolean(
    ANAVRIN_CONFIG.zkLogin.googleClientId &&
      ANAVRIN_CONFIG.zkLogin.saltServiceUrl &&
      ANAVRIN_CONFIG.zkLogin.proofServiceUrl
  );

  useEffect(() => {
    if (wallet.isConnected) {
      setPreferredAuthMethod((current) => current ?? "wallet");
    } else if (zkLoginSession) {
      setPreferredAuthMethod((current) => current ?? "zklogin");
    }
  }, [wallet.isConnected, zkLoginSession]);

  const completeZkLogin = useCallback(
    async (jwt: string, pending: ZkLoginPendingSession) => {
      const userSalt = await fetchUserSalt(jwt);
      const proof = await fetchProofEnvelope(jwt, pending);
      const address = jwtToAddress(jwt, userSalt, false);
      const session: ZkLoginSession = {
        provider: pending.provider,
        address,
        jwt,
        userSalt,
        maxEpoch: pending.maxEpoch,
        randomness: pending.randomness,
        ephemeralSecretKey: pending.ephemeralSecretKey,
        proof,
      };

      writeStorage(ANAVRIN_CONFIG.storageKeys.zkSession, session);
      writeStorage(ANAVRIN_CONFIG.storageKeys.zkPending, null);
      setZkLoginSession(session);
      setPreferredAuthMethod("zklogin");

      const cleanUrl = `${window.location.pathname}${window.location.search}`;
      window.history.replaceState({}, document.title, cleanUrl);
      toast.success("zkLogin session established");
    },
    []
  );

  useEffect(() => {
    const hashParams = parseHashParams(window.location.hash);
    const idToken = hashParams.get("id_token");
    if (!idToken) return;

    const pending = readStorage<ZkLoginPendingSession>(
      ANAVRIN_CONFIG.storageKeys.zkPending
    );

    if (!pending) {
      toast.error("Missing pending zkLogin session.");
      return;
    }

    let disposed = false;
    setIsProcessingZkLogin(true);

    void completeZkLogin(idToken, pending)
      .catch((error: unknown) => {
        if (disposed) return;
        const message =
          error instanceof Error ? error.message : "zkLogin sign-in failed.";
        toast.error(message);
      })
      .finally(() => {
        if (!disposed) setIsProcessingZkLogin(false);
      });

    return () => {
      disposed = true;
    };
  }, [completeZkLogin]);

  const beginZkLogin = useCallback(async () => {
    if (!ANAVRIN_CONFIG.zkLogin.googleClientId) {
      throw new Error("Missing VITE_ANAVRIN_ZKLOGIN_GOOGLE_CLIENT_ID.");
    }

    const systemState = await client.getLatestSuiSystemState();
    const keypair = Ed25519Keypair.generate();
    const randomness = generateRandomness();
    const maxEpoch =
      Number(systemState.epoch) + ANAVRIN_CONFIG.zkLogin.maxEpochOffset;
    const nonce = generateNonce(keypair.getPublicKey(), maxEpoch, randomness);

    const pending: ZkLoginPendingSession = {
      provider: ANAVRIN_ZKLOGIN_GOOGLE.key,
      maxEpoch,
      randomness,
      nonce,
      ephemeralSecretKey: keypair.getSecretKey(),
      createdAt: Date.now(),
    };

    writeStorage(ANAVRIN_CONFIG.storageKeys.zkPending, pending);
    window.location.assign(buildGoogleAuthUrl(nonce));
  }, [client]);

  const disconnectZkLogin = useCallback(() => {
    writeStorage(ANAVRIN_CONFIG.storageKeys.zkSession, null);
    writeStorage(ANAVRIN_CONFIG.storageKeys.zkPending, null);
    setZkLoginSession(null);
    if (preferredAuthMethod === "zklogin") {
      setPreferredAuthMethod(wallet.isConnected ? "wallet" : null);
    }
    toast.success("zkLogin session cleared");
  }, [preferredAuthMethod, wallet.isConnected]);

  const selectAuthMethod = useCallback((method: AuthMethod) => {
    setPreferredAuthMethod(method);
  }, []);

  const authMethod = useMemo<AuthMethod>(() => {
    if (
      preferredAuthMethod === "wallet" &&
      wallet.isConnected
    ) {
      return "wallet";
    }

    if (
      preferredAuthMethod === "zklogin" &&
      zkLoginSession
    ) {
      return "zklogin";
    }

    if (wallet.isConnected) return "wallet";
    if (zkLoginSession) return "zklogin";
    return null;
  }, [preferredAuthMethod, wallet.isConnected, zkLoginSession]);

  const activeAddress =
    authMethod === "wallet"
      ? wallet.address
      : authMethod === "zklogin"
        ? zkLoginSession?.address ?? null
        : null;

  return {
    wallet,
    authMethod,
    activeAddress,
    zkLoginEnabled,
    zkLoginSession,
    isProcessingZkLogin,
    beginZkLogin,
    disconnectZkLogin,
    selectAuthMethod,
  };
}
