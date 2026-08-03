// Firebase web-app config. See SETUP.md.
//
// These keys are NOT secrets — Firebase web config is public by design, and the
// security rules are what actually control access. Committing this file is fine
// and expected.
//
// Note: the Firebase console shows a snippet written for a bundler, with
// `import { initializeApp } from "firebase/app"` and a call to initializeApp().
// Neither belongs here — that bare specifier does not resolve in a browser, and
// js/store.js loads the SDK from Google's CDN and initialises the app itself.
// Only the config object is needed, and it must be exported.

export const firebaseConfig = {
  apiKey: 'AIzaSyDw_kKyz2idA1yVQwqOY_F2tbscXc4es5s',
  authDomain: 'llm-policy-radar.firebaseapp.com',
  databaseURL: 'https://llm-policy-radar-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'llm-policy-radar',
  storageBucket: 'llm-policy-radar.firebasestorage.app',
  messagingSenderId: '79926768302',
  appId: '1:79926768302:web:b3707b60d874060fe8b33f',
};
