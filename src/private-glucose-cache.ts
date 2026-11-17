import { MemoryGlucoseCache } from "./glucose-cache";
/** Web has no durable device-bound encryption key in this application. Never persist plaintext health rows. */
export const createPrivateGlucoseCache = async () => new MemoryGlucoseCache();
