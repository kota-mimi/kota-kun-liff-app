import type { NextApiRequest, NextApiResponse } from 'next';
import { getFirestore } from 'firebase-admin/firestore';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// ★★★ 環境変数から秘密の鍵を読み込む、安全な方法に戻しました！ ★★★
const serviceAccount = JSON.parse(
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY as string
);

// Firebase Admin SDKの初期化
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
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { userId, age, height, weight, targetWeight, goal } = req.body;
    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    const userData = {
      age: Number(age),
      height: Number(height),
      initialWeight: Number(weight),
      currentWeight: Number(weight),
      targetWeight: Number(targetWeight),
      goal: goal,
      createdAt: new Date(),
    };

    await db.collection('users').doc(userId).set(userData);

    console.log(`Successfully saved data for user: ${userId}`);
    
    res.status(200).json({ message: 'Success' });

  } catch (error) {
    console.error('Error saving to Firestore:', error);
    res.status(500).json({ error: 'Failed to save data' });
  }
}