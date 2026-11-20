import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Firebase Configuration
const firebaseConfig = {    
  apiKey: "AIzaSyBvYz78aahnnUGy0xL1zjdgp_or6_Qu380",
  authDomain: "sofpteam-67f99.firebaseapp.com",
  projectId: "sofpteam-67f99",
  storageBucket: "sofpteam-67f99.firebasestorage.app",
  messagingSenderId: "929512740689",
  appId: "1:929512740689:web:208be3f6d7a62101ade570",
  measurementId: "G-BWXL9NTBGN"
};

// Initialize Firebase (ป้องกันการสร้าง App ซ้ำ)
const app = getApps().length > 0
  ? getApp()
  : initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);

// Export Firebase App
export default app;
