import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Firebase Admin SDKの初期化
const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string
);

if (!getApps().length) {
  initializeApp({
    credential: cert(serviceAccount)
  });
}
const db = getFirestore();

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { userId } = req.query;
    
    if (!userId || typeof userId !== 'string') {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // ユーザーデータを取得
    const userRef = db.collection('users').doc(userId);
    const docSnap = await userRef.get();

    if (docSnap.exists) {
      // 食事記録を取得
      const mealsQuery = db.collection('meals').where('user_id', '==', userId).orderBy('timestamp', 'desc').limit(5);
      const mealsSnap = await mealsQuery.get();
      const meals = mealsSnap.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          timestamp: data.timestamp.toDate().toISOString(),
          id: doc.id
        };
      });

      const userData = docSnap.data();
      res.status(200).json({ isRegistered: true, userData, meals });
    } else {
      res.status(200).json({ isRegistered: false });
    }

  } catch (error) {
    console.error('Error getting user status:', error);
    res.status(500).json({ error: 'Failed to get user status' });
  }
}