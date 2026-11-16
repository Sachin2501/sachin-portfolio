import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, setLogLevel } from 'firebase/firestore';

const configModules = import.meta.glob('../firebase-applet-config.json', { eager: true });
const rawLocalConfig =
  configModules['../firebase-applet-config.json']?.default ||
  configModules['../firebase-applet-config.json'] ||
  null;

const firebaseConfig = rawLocalConfig || {
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'sonic-stratum-414518',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:403602393055:web:8534a4b136953b883fe66a',
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCHw_OmQtiUtAYFxkTc9V8GpJWhqElN5TQ',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'sonic-stratum-414518.firebaseapp.com',
  firestoreDatabaseId:
    import.meta.env.VITE_FIREBASE_DATABASE_ID ||
    'ai-studio-portfoliowebsite-3a2b7684-f1bb-4341-b355-6cedf3061e32',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'sonic-stratum-414518.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '403602393055',
};

// Silence internal @firebase/firestore WebChannel timeout logs since data is served by the Node.js + MongoDB backend
try {
  setLogLevel('silent');
} catch {
  // ignore
}

// Initialize Firebase App
export const app = initializeApp(firebaseConfig);

// Lazy/long-polling safe Firestore instance (kept exported for compatibility without eager network pings)
export const db = initializeFirestore(
  app,
  {
    experimentalAutoDetectLongPolling: true,
  },
  firebaseConfig.firestoreDatabaseId
);

// Initialize Authentication (used for Admin Google Sign-In)
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export const ADMIN_EMAIL = 'sachinkumar.gheura@gmail.com';

// Standardized error handler according to FirestoreErrorInfo schema
export const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
};

export function handleFirestoreError(error, operationType, path = null) {
  const errInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo:
        auth.currentUser?.providerData?.map((p) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.warn('Firestore Notice: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

