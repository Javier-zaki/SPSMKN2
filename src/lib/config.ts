/**
 * Feature flags for capabilities that need a Firebase service beyond the
 * free Spark plan.
 *
 * STORAGE_ENABLED: Cloud Storage for Firebase now requires the Blaze
 * (pay-as-you-go) plan even for tiny usage — Auth and Firestore alone stay
 * on the free Spark plan. Attachment upload (siswa's "bukti pendukung",
 * petugas's "bukti hasil") is gated behind this flag so the rest of the
 * app works with zero billing setup. Flip to `true` once Storage is
 * enabled in the Firebase console and `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
 * is set — no other code changes needed.
 */
export const STORAGE_ENABLED = false;
