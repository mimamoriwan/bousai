import { initializeApp } from "firebase/app";
import { getAuth, signInWithRedirect, GoogleAuthProvider, signInAnonymously, linkWithRedirect } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyARiM_S2bfzS_3EkXYaiisFdWGmxj2dtzk",
    authDomain: "tsukuba-pet-bousai.firebaseapp.com",
    projectId: "tsukuba-pet-bousai",
    storageBucket: "tsukuba-pet-bousai.firebasestorage.app",
    messagingSenderId: "491489046094",
    appId: "1:491489046094:web:cec28b0f6da609972f9d1f"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

async function run() {
    try {
        const userCred = await signInAnonymously(auth);
        console.log("Anon logged in", userCred.user.uid);
        await linkWithRedirect(userCred.user, provider);
        console.log("Redirect triggered");
    } catch (e) {
        console.error("Error!!!", e);
    }
}
run();
