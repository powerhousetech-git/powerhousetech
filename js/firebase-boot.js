/**
 * Lightweight Firebase Auth bootstrap for static pages.
 * Sets window.phFirebaseAuth and dispatches ph-firebase-ready.
 * Uses local persistence so sign-in survives navigation across pages.
 */
import { initializeApp, getApps } from 'https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from 'https://www.gstatic.com/firebasejs/12.14.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: 'AIzaSyD9fHOILnFLauZqd-C2AZwm-vrkpQk-sV4',
  authDomain: 'powerhouse-tech-f6da1.firebaseapp.com',
  projectId: 'powerhouse-tech-f6da1',
  storageBucket: 'powerhouse-tech-f6da1.firebasestorage.app',
  messagingSenderId: '946732625664',
  appId: '1:946732625664:web:627677c716fcf7c16b0de5',
  measurementId: 'G-QRZLG84GYV',
};

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);

setPersistence(auth, browserLocalPersistence).catch(function () {});

window.phFirebaseAuth = {
  auth,
  googleProvider: new GoogleAuthProvider(),
  signInWithPopup,
  signOut,
  onAuthStateChanged,
};
window.dispatchEvent(new CustomEvent('ph-firebase-ready'));
