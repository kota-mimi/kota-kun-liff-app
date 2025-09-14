import type { NextApiRequest, NextApiResponse } from 'next';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Client } from '@line/bot-sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Firebase Admin SDKの初期化
if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)) });
}
const db = getFirestore();

// LINE SDKの初期化
const lineClient = new Client({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!,
  channelSecret: process.env.LINE_CHANNEL_SECRET!,
});

// Gemini AIの初期化
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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
      goal,
      createdAt: new Date(),
    };
    await db.collection('users').doc(userId).set(userData, { merge: true });

    const prompt = `あなたはフレンドリーで優秀なパーソナルトレーナーです。以下のクライアント情報に基づき、基礎代謝(BMR)、1日の消費カロリー(TDEE、活動レベル1.55)、目標摂取カロリー(TDEE-300kcal)、PFCバランス(P30:F20:C50)を計算し、歓迎と励ましの言葉と共に、最初のアドバイスを絵文字を交えて生成してください。\n\n- 年齢: ${userData.age}歳\n- 身長: ${userData.height}cm\n- 体重: ${userData.currentWeight}kg\n- 目標: ${userData.goal}`;
    
    const result = await geminiModel.generateContent(prompt);
    await lineClient.pushMessage({
      to: userId,
      messages: [{ type: 'text', text: result.response.text() }]
    });
    
    res.status(200).json({ message: 'Success' });
  } catch (error) {
    console.error('Error in submit-counseling:', error);
    res.status(500).json({ error: 'Failed to process counseling' });
  }
}