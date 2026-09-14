// Firebase client SDK — used in the browser (Client Components, hooks).
// Never put admin/service-account logic here.

import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

function requireConfig() {
  const missing = Object.entries(firebaseConfig)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length > 0) {
    // Loud failure on purpose: a half-configured Firebase client silently
    // breaks auth/Firestore in ways that are painful to debug later.
    console.error(
      `[firebase] Missing env vars: ${missing.join(
        ", "
      )}. Check .env.local against .env.local.example.`
    );
  }
}

let app: FirebaseApp;
if (typeof window !== "undefined") {
  requireConfig();
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
} else {
  // On the server, only initialize if not already done (for SSR paths that
  // import this module incidentally). Real server-side privileged access
  // should go through lib/firebase/admin.ts instead.
  app = getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export const firebaseApp: FirebaseApp = app;
export const auth: Auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const storage: FirebaseStorage = getStorage(app);
