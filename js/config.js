import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";

const firebaseConfig = {
    apiKey: "AIzaSyCUf800FNv--emagtwh5YevSPqFtk7Miiw",
    authDomain: "remuneracao-equipe.firebaseapp.com",
    projectId: "remuneracao-equipe",
    storageBucket: "remuneracao-equipe.firebasestorage.app",
    messagingSenderId: "1070188778724",
    appId: "1:1070188778724:web:684e19b2259a99b17288f1"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const appId = 'remuneracao';
