// Script to create pending_admins documents for existing users
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, setDoc } from 'firebase/firestore';

// Your Firebase configuration (from firebase-applet-config.json)
const firebaseConfig = {
  apiKey: "AIzaSyAiKNbGSLlPfd4ul4SpMbQFXnx7ekHHnrk",
  authDomain: "anarpura-kollan-tohobil.firebaseapp.com",
  projectId: "anarpura-kollan-tohobil",
  storageBucket: "anarpura-kollan-tohobil.firebasestorage.app",
  messagingSenderId: "722806892952",
  appId: "1:722806892952:web:778cd1071dc15e64a523ed",
  measurementId: "G-0KNVVZCC29"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// List of existing users from Firebase Authentication
const existingUsers = [
  {
    uid: "YyNFWg4ZfcNAySoCZQ1R2ZeilDz2",
    email: "arafatinbusiness1212@gmail.com",
    name: "arafatinbusiness1212"
  },
  {
    uid: "KD0ZL6a2nNXikiQ2kJRZv78fVqK2",
    email: "arafatbusinessaihelp@gmail.com",
    name: "arafatbusinessaihelp"
  },
  {
    uid: "445FydgPz7ga8AxAmGW9ccQjUpd2",
    email: "shariful.hoq91@gmail.com",
    name: "shariful.hoq91"
  }
];

async function createPendingAdmins() {
  console.log('Starting to create pending admin documents...');
  
  for (const user of existingUsers) {
    try {
      // Create pending admin document
      await setDoc(doc(db, 'pending_admins', user.uid), {
        uid: user.uid,
        name: user.name,
        email: user.email,
        phone: '',
        requestedAt: new Date().toISOString(),
        status: 'pending'
      });
      
      console.log(`✅ Created pending admin for: ${user.email} (UID: ${user.uid})`);
    } catch (error) {
      console.error(`❌ Error creating pending admin for ${user.email}:`, error.message);
    }
  }
  
  console.log('✅ All pending admin documents created successfully!');
  console.log('These users will now appear in the AdminPanel for approval.');
}

// Run the script
createPendingAdmins().then(() => {
  console.log('Script completed.');
  process.exit(0);
}).catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});
