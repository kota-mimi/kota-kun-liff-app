import type { NextApiRequest, NextApiResponse } from 'next';
import * as line from '@line/bot-sdk';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- 初期設定 ---
if (!getApps().length) {
  initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY!)) });
}
const db = getFirestore();
const lineConfig = { channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN!, channelSecret: process.env.LINE_CHANNEL_SECRET! };
const lineClient = new line.Client(lineConfig);
const visionClient = new ImageAnnotatorClient();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
export const config = { api: { bodyParser: false } };
const getRawBody = (req: NextApiRequest): Promise<Buffer> => new Promise((resolve, reject) => {
  const chunks: Buffer[] = [];
  req.on('data', chunk => chunks.push(chunk)).on('end', () => resolve(Buffer.concat(chunks))).on('error', reject);
});

// --- メイン処理 ---
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const bodyBuffer = await getRawBody(req);
    if (!line.validateSignature(bodyBuffer.toString(), lineConfig.channelSecret, req.headers['x-line-signature'] as string)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
    const body = JSON.parse(bodyBuffer.toString());
    await Promise.all(body.events.map(handleEvent));
    res.status(200).json({ status: 'success' });
  } catch (err) { // ★★★ エラーの型指定を修正！ ★★★
    console.error("Webhook Error:", err);
    res.status(500).json({ status: 'error' });
  }
}

const handleEvent = async (event: line.WebhookEvent) => {
  if (event.type === 'message') {
    if (event.message.type === 'text') return handleTextMessage(event as line.MessageEvent & { message: line.TextMessage });
    if (event.message.type === 'image') return handleImageMessage(event as line.MessageEvent & { message: line.ImageMessage });
  }
};

const handleTextMessage = async (event: line.MessageEvent & { message: line.TextMessage }) => {
    const userId = event.source.userId!;
    const text = event.message.text.trim();
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const state = userDoc.exists && userDoc.data()!.conversation_state ? userDoc.data()!.conversation_state : null;
    const context = userDoc.exists && userDoc.data()!.context ? userDoc.data()!.context : {};

    if (state === 'waiting_for_meal_text') {
        await analyzeMealAndReply(userId, 'text', text, context.meal_type || '食事', event.replyToken);
        return userRef.update({ conversation_state: FieldValue.delete(), context: FieldValue.delete() });
    }
    
    if (text === '食事') {
        await userRef.set({ conversation_state: 'waiting_for_meal_type' }, { merge: true });
        const quickReply = { items: [ { type: 'action', action: { type: 'message', label: '朝食', text: '朝食' } }, { type: 'action', action: { type: 'message', label: '昼食', text: '昼食' } }, { type: 'action', action: { type: 'message', label: '夕食', text: '夕食' } }, { type: 'action', action: { type: 'message', label: '間食', text: '間食' } } ] };
        return lineClient.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: 'どの食事を記録しますか？', quickReply }] });
    }
    if (['朝食', '昼食', '夕食', '間食'].includes(text)) {
        await userRef.set({ conversation_state: 'waiting_for_record_method', context: { meal_type: text } }, { merge: true });
        const quickReply = { items: [ { type: 'action', action: { type: 'camera', label: 'カメラで記録' } }, { type: 'action', action: { type: 'message', label: 'テキストで記録', text: 'テキストで記録' } }, { type: 'action', action: { type: 'message', label: '過去の食事から記録', text: '過去の食事から記録' } } ] };
        return lineClient.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: `${text}の記録方法を選んでください`, quickReply }] });
    }
    if (text === 'テキストで記録') {
        await userRef.update({ conversation_state: 'waiting_for_meal_text' });
        return lineClient.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: '食事の内容を教えてください (例: ラーメンと餃子)' }] });
    }
    if (text === '過去の食事から記録') {
        await userRef.update({ conversation_state: FieldValue.delete(), context: FieldValue.delete() });
        return lineClient.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: 'この機能は現在開発中です！💪 LIFFのマイページから過去の記録を確認できます。' }] });
    }

    const prompt = `あなたは優秀なダイエットコーチです。ユーザーから「${text}」というメッセージが届きました。簡潔かつポジティブに返信してください。`;
    const result = await geminiModel.generateContent(prompt);
    return lineClient.replyMessage({ replyToken: event.replyToken, messages: [{ type: 'text', text: result.response.text() }] });
};

const handleImageMessage = async (event: line.MessageEvent & { message: line.ImageMessage }) => {
    const userId = event.source.userId!;
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    const context = userDoc.exists && userDoc.data()!.context ? userDoc.data()!.context : {};
    const meal_type = context.meal_type || '食事';

    const stream = await lineClient.getMessageContent(event.message.id);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) { chunks.push(chunk); }
    const imageBuffer = Buffer.concat(chunks);

    await analyzeMealAndReply(userId, 'image', imageBuffer, meal_type, event.replyToken);
    return userRef.update({ conversation_state: FieldValue.delete(), context: FieldValue.delete() });
};

const analyzeMealAndReply = async (userId: string, type: 'text' | 'image', data: string | Buffer, meal_type: string, replyToken: string) => {
    let mealText = '';
    if (type === 'image') {
        const [result] = await visionClient.labelDetection({ image: { content: data as Buffer } });
        const labels = result.labelAnnotations;
        mealText = labels && labels.length > 0 && labels[0].description ? labels.map(l => l.description!).slice(0, 3).join(', ') : '不明な料理';
    } else {
        mealText = data as string;
    }
    await db.collection('users').doc(userId).collection('meals').add({ text: mealText, meal_type, type, timestamp: new Date() });
    
    const prompt = `食事内容: 「${mealText}」\nこの食事の「食事名」「総カロリー(kcal)」「タンパク質のカロリー(kcal)」「脂質のカロリー(kcal)」「炭水化物のカロリー(kcal)」だけを、以下の形式で出力してください。他の言葉や挨拶、アドバイスは一切含めないでください。\n\n食事名: [ここに食事名]\n総カロリー: [ここに推定カロリー]kcal\nPFCカロリー: P[タンパク質カロリー]kcal, F[脂質カロリー]kcal, C[炭水化物カロリー]kcal`;
    const result = await geminiModel.generateContent(prompt);
    return lineClient.replyMessage({ replyToken, messages: [{ type: 'text', text: result.response.text() }] });
};