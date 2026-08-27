export type { UserProperties, UserPropertyPatch, UserPropertyValue } from "./types";
export { RESERVED_USER_PROPERTY_KEYS, isReservedUserPropertyKey } from "./reserved";
export type { ReservedUserPropertyKey } from "./reserved";
export { serializeUserPropertyValue, toQueryParams, paramsHash } from "./serialize";
export { applyUserPropertyPatch } from "./applyPatch";
// `userPropertyStore` — the process-wide instance — is deliberately NOT
// re-exported for hosts: `OnboardingStudio` is the front door. It is imported
// directly by `OnboardingStudio.ts` and `useUserProperties.ts`.
export { createUserPropertyStore, USER_PROPERTIES_STORAGE_KEY } from "./store";
export type { UserPropertySnapshot, UserPropertyStorage, UserPropertyStore } from "./store";
export { useUserProperties } from "./useUserProperties";
