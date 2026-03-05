import {
  ADMIN_CAP_TYPE,
  ARENA_MATCH_TYPE,
  MODULE,
  MONSTER_TYPE,
  PACKAGE_ID,
  TREASURY_ID,
} from "./constants";

export { ADMIN_CAP_TYPE, ARENA_MATCH_TYPE, MODULE, MONSTER_TYPE, PACKAGE_ID, TREASURY_ID };

export const ACTIVE_PLAYER_EVENT_TYPES = [
  `${PACKAGE_ID}::${MODULE}::MatchCreated`,
  `${PACKAGE_ID}::${MODULE}::MatchDepositMonster`,
  `${PACKAGE_ID}::${MODULE}::MatchDepositStake`,
] as const;
