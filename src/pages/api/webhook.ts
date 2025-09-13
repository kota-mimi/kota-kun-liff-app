import type { NextApiRequest, NextApiResponse } from 'next';
import * as line from '@line/bot-sdk';

// ★★★ あなたの秘密の鍵を、ここに直接書き込みます！ ★★★
// これで「読み込めない」という問題は100%発生しません。
const lineConfig = {
  channelAccessToken: 'sCf/zZSQdEioCsdBjdj3sNg0BvrWiqw3zruTcwFNTdtlDw02x45w/QEg8vbWEs9EazSiS1UziVKoz6p75foPbnaiNFxgCBUerBr1s+969C6IVrvVEaDt0FPYFWNEH6Qtczqf3E495P0QmkV0altlEQdB04t89/1O/w1cDnyilFU=',
  channelSecret: '88779957b5120a3d043e922e1626652a',
};
// ★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★★

const client = new line.Client(lineConfig);

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // 署名の検証
  const bodyBuffer = await getRawBody(req);
  const bodyString = bodyBuffer.toString();
  const signature = req.headers['x-line-signature'] as string;

  if (!line.validateSignature(bodyString, lineConfig.channelSecret, signature)) {
    console.error("Signature validation failed");
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Webhookイベントを処理
  const body = JSON.parse(bodyString);
  const events: line.WebhookEvent[] = body.events;

  // LINEからの検証リクエストには中身がないので、ここで成功を返す
  if (events.length === 0) {
    return res.status(200).json({ message: 'OK' });
  }
  
  const results = await Promise.all(
    events.map(async (event) => {
      try {
        if (event.type === 'follow') {
          return handleFollow(event);
        }
      } catch (err) {
        console.error(err);
      }
    })
  );

  res.status(200).json({ results });
}

// 友だち追加イベントを処理する関数
const handleFollow = (event: line.FollowEvent) => {
  const richMessage: line.FlexMessage = {
    type: 'flex',
    altText: '初回カウンセリングのご案内です。',
    contents: {
      type: 'bubble',
      hero: {
        type: 'image',
        url: 'https://storage.googleapis.com/proud-ground-244503.appspot.com/counseling_header.jpeg',
        size: 'full',
        aspectRatio: '20:13',
        aspectMode: 'cover',
      },
      body: {
        type: 'box',
        layout: 'vertical',
        contents: [
          { type: 'text', text: 'ようこそ！', weight: 'bold', size: 'xl' },
          { type: 'text', text: '最高のスタートを切るために、まずはあなたのことを教えてください。', margin: 'md', wrap: true },
        ],
      },
      footer: {
        type: 'box',
        layout: 'vertical',
        spacing: 'sm',
        contents: [
          {
            type: 'button',
            style: 'primary',
            height: 'sm',
            action: {
              type: 'uri',
              label: '初回カウンセリングを開始',
              uri: 'https://liff.line.me/2007945061-DEEaglg8'
            },
            color: '#00b900'
          },
        ],
        flex: 0,
      },
    },
  };
  return client.replyMessage(event.replyToken, richMessage);
};

// Next.jsでリクエストボディを正しく扱うためのヘルパー関数
const getRawBody = (req: NextApiRequest): Promise<Buffer> => {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
  });
};

// Next.jsのおまじない
export const config = {
  api: {
    bodyParser: false,
  },
};