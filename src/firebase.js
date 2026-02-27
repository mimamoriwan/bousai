import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyARiM_S2bfzS_3EkXYaiisFdWGmxj2dtzk",
    authDomain: "mimamori-wan.web.app",
    projectId: "tsukuba-pet-bousai",
    storageBucket: "tsukuba-pet-bousai.firebasestorage.app",
    messagingSenderId: "491489046094",
    appId: "1:491489046094:web:cec28b0f6da609972f9d1f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

// Initialize Cloud Storage and get a reference to the service
export const storage = getStorage(app);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();
