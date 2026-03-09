export type AuthMethod = "wallet" | "zklogin" | null;

export type CameraFocus = "face" | "body" | "style";

export type ExperienceStage = "connect" | "creator" | "minting" | "spawned";

export type AvatarOption<T extends number | string> = {
  value: T;
  label: string;
  description?: string;
  swatch?: string;
};

export type AvatarDraft = {
  appearance: {
    frame_type: number;
    skin_tone: number;
    hair_type: number;
    hair_color: number;
    height_class: number;
    body_type: number;
    face_style: number;
    eye_color: number;
    eye_style: number;
    mouth_style: number;
    facial_hair: number;
  };
  behavior: {
    expression_profile: number;
    voice_type: number;
    style_type: number;
    idle_style: number;
    walk_style: number;
    base_emote_pack: number;
  };
  starter_style: {
    top: string;
    pants: string;
    shoes: string;
    accessory: string;
    aura: string;
  };
};

export type AvatarAttribute = {
  trait_type: string;
  value: string;
};

export type AvatarMintMetadata = {
  name: string;
  description: string;
  attributes: AvatarAttribute[];
  image_url: string;
  portrait_uri: string;
  base_model_uri: string;
  seed: string;
};

export type MintConfigState = {
  objectId: string;
  ownerKind: string;
  mintPriceMist: string;
  mintEnabled: boolean;
  treasuryBalanceMist: string;
};

export type ActiveIdentity = {
  objectId: string;
  owner: string;
  name: string;
  description: string;
  imageUrl: string;
  portraitUri: string;
  baseModelUri: string;
  level: number;
  xp: number;
  objectType: string;
  draft: AvatarDraft;
};

export type ZkLoginPendingSession = {
  provider: string;
  maxEpoch: number;
  randomness: string;
  nonce: string;
  ephemeralSecretKey: string;
  createdAt: number;
};

export type ZkLoginProofEnvelope = {
  proofPoints: {
    a: string[];
    b: string[][];
    c: string[];
  };
  issBase64Details: {
    value: string;
    indexMod4: number;
  };
  headerBase64: string;
  addressSeed: string;
};

export type ZkLoginSession = {
  provider: string;
  address: string;
  jwt: string;
  userSalt: string;
  maxEpoch: number;
  randomness: string;
  ephemeralSecretKey: string;
  proof?: ZkLoginProofEnvelope;
};

export type WalletDirectoryEntry = {
  name: string;
  installed: boolean;
  matchesPreferred: boolean;
};

export type WorldSpawn = {
  district: string;
  heading: number;
  position: [number, number, number];
};
