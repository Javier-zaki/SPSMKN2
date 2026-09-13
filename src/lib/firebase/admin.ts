// Firebase Admin SDK — server-only. Used in API routes / server actions to
// verify ID tokens and read/write Firestore with elevated privilege.
//
// SECURITY: never import this file from a Client Component. The role in a
// verified ID token's custom claims is the only role SPSMKN2 trusts — a
// role field sent from the browser is never trusted on its own.

import { getApps, initializeApp, cert, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

function getAdminApp(): App {
  if (getApps().length) return getApps()[0];

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error(
      "[firebase-admin] Missing FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY. " +
        "These come from a service account JSON — see README setup instructions."
    );
  }

  return initializeApp({
    credential: cert({ projectId, clientEmail, privateKey }),
  });
}

export const adminApp = getAdminApp();
export const adminAuth = getAuth(adminApp);
export const adminDb = getFirestore(adminApp);

/**
 * Verifies a Firebase ID token sent from the client and returns its claims,
 * including the trusted `role` custom claim set at account-creation time.
 * Throws if the token is invalid/expired.
 */
export async function verifySessionToken(idToken: string) {
  const decoded = await adminAuth.verifyIdToken(idToken, true);
  return decoded as typeof decoded & { role?: string };
}
