import type { NextApiRequest, NextApiResponse } from 'next';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

// --- 初期設定 ---
if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)) });
}
const db = getFirestore();

// --- メイン処理 ---
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const { userId } = req.query;
    if (!userId || typeof userId !== 'string') return res.status(400).json({ error: 'User ID is required' });

    const userDocRef = db.collection('users').doc(userId);
    const docSnap = await userDocRef.get();

    if (docSnap.exists()) {
      const mealsQuery = userDocRef.collection('meals').orderBy('timestamp', 'desc').limit(5);
      const mealsSnap = await mealsQuery.get();
      const meals = mealsSnap.docs.map(doc => {
          const data = doc.data();
          // FirestoreのTimestampオブジェクトをJSONでシリアライズ可能な形式に変換
          return { ...data, timestamp: data.timestamp.toDate().toISOString() };
      });
      
      res.status(200).json({ isRegistered: true, userData: docSnap.data(), meals });
    } else {
      res.status(200).json({ isRegistered: false });
    }
  } catch (error) { // ★★★ エラーの型指定を修正！ ★★★
    console.error('Error in get-user-status:', error);
    res.status(500).json({ error: 'Failed to get user status' });
  }
}