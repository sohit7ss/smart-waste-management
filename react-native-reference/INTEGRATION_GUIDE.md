# React Native Integration Guide — For Your Friend

This is a reference guide for your friend whose React Native app submits reports to Firebase.
**No changes are needed on your friend's app IF it already uses these exact Firestore field names.**

---

## Required Firestore Field Names (reports collection)

These are the **exact field names** the FastAPI sync depends on. Make sure all reports in the `reports` collection have these:

```javascript
await firestore().collection('reports').add({
  address: locationAddress,        // string address
  description: description,        // string
  imageUrl: imageDownloadUrl,      // Firebase Storage URL or null
  location: {
    latitude: userLocation.latitude,
    longitude: userLocation.longitude,
  },
  phone: userPhone,                // citizen phone number
  priority: selectedPriority,      // "Low" | "Medium" | "High" | "Critical"
  status: 'Pending',               // always start as Pending
  userId: auth().currentUser.uid,  // Firebase UID
  wasteType: selectedWasteType,    // waste category
  createdAt: firestore.FieldValue.serverTimestamp(),
});
```

---

## Real-Time Status Listener (Optional Enhancement)

Add this to the complaints/tracking screen so citizens see **instant status updates** when admin resolves their complaint:

```javascript
import firestore from '@react-native-firebase/firestore';
import auth from '@react-native-firebase/auth';
import { useEffect, useState } from 'react';

// Inside your complaints screen component:
const [myReports, setMyReports] = useState([]);

useEffect(() => {
  const currentUser = auth().currentUser;
  if (!currentUser) return;

  // Real-time listener - updates instantly when admin changes status
  const unsubscribe = firestore()
    .collection('reports')
    .where('userId', '==', currentUser.uid)
    .orderBy('createdAt', 'desc')
    .onSnapshot(snapshot => {
      const reports = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      setMyReports(reports);
    }, error => {
      console.error('Firestore listener error:', error);
    });

  return () => unsubscribe(); // cleanup on unmount
}, []);

// Status badge colors for UI
const getStatusColor = (status) => {
  switch(status) {
    case 'Pending': return '#eab308';
    case 'In Progress': return '#3b82f6';
    case 'Resolved': return '#22c55e';
    default: return '#64748b';
  }
};
```

---

## Connecting to Your Backend (Optional)

If you want the RN app to also talk directly to your FastAPI backend:

**config.js** (in RN app root):
```javascript
// Find your IP with: ipconfig (Windows) → IPv4 Address
// Both devices must be on SAME WiFi
export const API_BASE_URL = 'http://YOUR_PC_IP:8000';
```

**src/services/api.js** (in RN app):
```javascript
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../config';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('backend_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
```

---

## How the Integration Works

1. Citizen submits report in RN app → saved to **Firestore** `reports` collection
2. FastAPI backend syncs Firestore every **15 seconds** → creates complaint in SQLite
3. Admin sees complaint on dashboard with **🔥 Firebase** badge
4. Admin resolves complaint → FastAPI pushes status back to **Firestore**
5. Citizen's RN app sees "Resolved" status in **real-time** (if using the listener above)
