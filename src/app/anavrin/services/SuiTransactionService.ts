import type { SuiClient, SuiTransactionBlockResponse } from "@mysten/sui/client";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { getExtendedEphemeralPublicKey, getZkLoginSignature } from "@mysten/sui/zklogin";

import { ANAVRIN_CONFIG } from "../config/anavrinConfig";
import type { ZkLoginProofEnvelope, ZkLoginSession } from "../types";

function parseErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  return "Transaction failed.";
}

async function fetchProofEnvelope(
  session: ZkLoginSession
): Promise<ZkLoginProofEnvelope> {
  const proofServiceUrl = ANAVRIN_CONFIG.zkLogin.proofServiceUrl;
  if (!proofServiceUrl) {
    throw new Error("Missing VITE_ANAVRIN_ZKLOGIN_PROOF_URL.");
  }

  const keypair = Ed25519Keypair.fromSecretKey(session.ephemeralSecretKey);
  const response = await fetch(proofServiceUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jwt: session.jwt,
      maxEpoch: session.maxEpoch,
      jwtRandomness: session.randomness,
      extendedEphemeralPublicKey: getExtendedEphemeralPublicKey(
        keypair.getPublicKey()
      ),
      keyClaimName: "sub",
    }),
  });

  if (!response.ok) {
    throw new Error("Proof service rejected zkLogin execution.");
  }

  const data = (await response.json()) as {
    proof?: ZkLoginProofEnvelope;
    inputs?: ZkLoginProofEnvelope;
  };

  const proof = data.proof ?? data.inputs;
  if (!proof) {
    throw new Error("Proof service did not return zkLogin inputs.");
  }

  return proof;
}

export async function executeZkLoginTransaction(args: {
  client: SuiClient;
  transaction: Transaction;
  session: ZkLoginSession;
}) {
  const { client, transaction, session } = args;

  transaction.setSenderIfNotSet(session.address);
  const transactionBlock = await transaction.build({ client });
  const keypair = Ed25519Keypair.fromSecretKey(session.ephemeralSecretKey);
  const { signature: userSignature } = await keypair.signTransaction(
    transactionBlock
  );
  const proof = session.proof ?? (await fetchProofEnvelope(session));
  const zkSignature = getZkLoginSignature({
    inputs: proof,
    maxEpoch: session.maxEpoch,
    userSignature,
  });

  const response = await client.executeTransactionBlock({
    transactionBlock,
    signature: zkSignature,
    options: {
      showEffects: true,
      showEvents: true,
      showObjectChanges: true,
    },
    requestType: "WaitForLocalExecution",
  });

  await client.waitForTransaction({ digest: response.digest });
  return { response, proof };
}

export function extractCreatedObjectId(
  response: Pick<SuiTransactionBlockResponse, "objectChanges">,
  objectType: string
) {
  const created = response.objectChanges?.find(
    (change) =>
      change.type === "created" &&
      change.objectType === objectType
  );

  return created && "objectId" in created ? created.objectId : null;
}

export function formatSuiTransactionError(error: unknown) {
  return parseErrorMessage(error);
}
