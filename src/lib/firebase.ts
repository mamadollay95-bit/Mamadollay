import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('https://www.googleapis.com/auth/drive.file');

let driveAccessToken: string | null = sessionStorage.getItem('drive_token');

export const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    setDriveToken(credential?.accessToken || null);
    return result;
};

export const getDriveToken = () => driveAccessToken;

export const setDriveToken = (token: string | null) => {
    driveAccessToken = token;
    if (token) {
        sessionStorage.setItem('drive_token', token);
    } else {
        sessionStorage.removeItem('drive_token');
    }
};

export const clearDriveToken = () => setDriveToken(null);

export const logOut = async () => {
    clearDriveToken();
    return signOut(auth);
};

// Test connection
async function testConnection() {
  try {
    if (db) {
       await getDocFromServer(doc(db, 'test', 'connection'));
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
