import { Transaction } from "@mysten/sui/transactions";

import { AVATAR_CONTRACT, AVATAR_TARGETS } from "./avatarContract";

export function buildPauseMintTx() {
  const tx = new Transaction();
  tx.moveCall({
    target: AVATAR_TARGETS.pauseMint,
    arguments: [tx.object(AVATAR_CONTRACT.adminCapId), tx.object(AVATAR_CONTRACT.mintConfigId)],
  });
  return tx;
}

export function buildResumeMintTx() {
  const tx = new Transaction();
  tx.moveCall({
    target: AVATAR_TARGETS.resumeMint,
    arguments: [tx.object(AVATAR_CONTRACT.adminCapId), tx.object(AVATAR_CONTRACT.mintConfigId)],
  });
  return tx;
}

export function buildSetMintPriceTx(newPriceMist: string) {
  const normalized = newPriceMist.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new Error("Mint price must be a whole MIST value.");
  }

  const tx = new Transaction();
  tx.moveCall({
    target: AVATAR_TARGETS.setMintPrice,
    arguments: [
      tx.object(AVATAR_CONTRACT.adminCapId),
      tx.object(AVATAR_CONTRACT.mintConfigId),
      tx.pure.u64(normalized),
    ],
  });
  return tx;
}
