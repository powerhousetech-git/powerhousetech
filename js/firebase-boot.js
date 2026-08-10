/**
 * Lightweight Firebase Auth bootstrap for static pages.
 * Sets window.phFirebaseAuth and dispatches ph-firebase-ready.
 */
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.14.0/firebase-app.js';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
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

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
window.phFirebaseAuth = {
  auth,
  googleProvider: new GoogleAuthProvider(),
  signInWithPopup,
  signOut,
  onAuthStateChanged,
};
window.dispatchEvent(new CustomEvent('ph-firebase-ready'));
