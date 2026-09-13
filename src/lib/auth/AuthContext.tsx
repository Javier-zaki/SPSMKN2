"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase/client";
import type { AppUser } from "@/lib/types";

interface AuthContextValue {
  firebaseUser: FirebaseUser | null;
  profile: AppUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  firebaseUser: null,
  profile: null,
  loading: true,
});

// NOTE: this profile (including `role`) is read from Firestore for display
// and client-side UI branching only. It is NOT the source of truth for
// authorization — every server action / API route re-verifies the role from
// the Firebase ID token's custom claims via lib/firebase/admin.ts. A user
// editing their own Firestore doc client-side cannot grant themselves admin.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      if (!user) {
        setProfile(null);
        setLoading(false);
      }
    });
    return () => unsubAuth();
  }, []);

  useEffect(() => {
    if (!firebaseUser) return;
    const ref = doc(db, "users", firebaseUser.uid);
    const unsubDoc = onSnapshot(
      ref,
      (snap) => {
        setProfile(snap.exists() ? (snap.data() as AppUser) : null);
        setLoading(false);
      },
      () => setLoading(false)
    );
    return () => unsubDoc();
  }, [firebaseUser]);

  return (
    <AuthContext.Provider value={{ firebaseUser, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
