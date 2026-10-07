// Runs a function with `globalThis.crypto.getRandomValues` absent or present,
// and counts the calls to each source of randomness, so a log can show which
// branch of studio-sdk's `randomBytes16` minted a run id. A valid UUIDv7 comes
// out of both branches, so the id alone proves nothing.
// No relative imports, so `node --test` can load this file as is.

export type RandomSourceMode = "absent" | "present";

export interface RandomSourceResult<T> {
  result: T;
  /** `typeof globalThis.crypto?.getRandomValues` before the call changed anything. */
  typeBefore: string;
  /** The same, while `fn` ran. */
  typeDuring: string;
  mathRandomCalls: number;
  getRandomValuesCalls: number;
}

type GetRandomValues = <A extends ArrayBufferView | null>(array: A) => A;
type Global = { crypto?: { getRandomValues?: GetRandomValues } };

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

/** A lowercase RFC 9562 UUIDv7: version nibble 7, variant 10xx. */
export function isLowercaseUuidV7(id: string): boolean {
  return typeof id === "string" && UUID_V7.test(id);
}

export const typeOfGetRandomValues = (): string => typeof (globalThis as Global).crypto?.getRandomValues;

/**
 * "absent": `globalThis.crypto` is replaced by an object without
 * `getRandomValues` while `fn` runs (deleting the method is not enough: on
 * Node it is inherited from `Crypto.prototype`, so a delete leaves it there).
 * "present": the runtime's `getRandomValues` is wrapped to count calls; when
 * the runtime has none, `supply` is installed for the call. Both restore every
 * global they touched, even when `fn` throws.
 */
export function withRandomSource<T>(mode: RandomSourceMode, fn: () => T, supply?: GetRandomValues): RandomSourceResult<T> {
  const g = globalThis as Global;
  const typeBefore = typeOfGetRandomValues();
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  const original = g.crypto;
  const random = Math.random;
  let mathRandomCalls = 0;
  let getRandomValuesCalls = 0;

  Math.random = () => {
    mathRandomCalls += 1;
    return random();
  };
  let replacement: Global["crypto"];
  if (mode === "absent") {
    replacement = {};
  } else {
    const impl = original?.getRandomValues ? original.getRandomValues.bind(original) : supply;
    if (!impl) throw new Error("withRandomSource: no getRandomValues on this runtime and none supplied");
    replacement = {
      getRandomValues: ((array) => {
        getRandomValuesCalls += 1;
        return impl(array);
      }) as GetRandomValues,
    };
  }
  Object.defineProperty(globalThis, "crypto", { value: replacement, configurable: true, writable: true, enumerable: false });
  try {
    const typeDuring = typeOfGetRandomValues();
    const result = fn();
    return { result, typeBefore, typeDuring, mathRandomCalls, getRandomValuesCalls };
  } finally {
    Math.random = random;
    if (cryptoDescriptor) Object.defineProperty(globalThis, "crypto", cryptoDescriptor);
    else delete (globalThis as { crypto?: unknown }).crypto;
  }
}
