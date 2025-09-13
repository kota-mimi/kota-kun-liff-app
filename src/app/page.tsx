"use client";

import { useEffect, useState } from 'react';
import liff from '@line/liff';

export default function CounselingPage() {
  const [message, setMessage] = useState('LIFFの初期化中です...');
  const [userId, setUserId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // LIFFの初期化は一度だけ実行する
    liff.init({ liffId: '2007945061-DEEaglg8' })
      .then(() => {
        setMessage('ようこそ！あなたの情報を入力してください。');
        if (liff.isLoggedIn()) {
          liff.getProfile().then(profile => {
            setUserId(profile.userId);
            // PCブラウザでのテスト用に、コンソールにユーザーIDを表示
            console.log('User ID:', profile.userId); 
          });
        } else {
          // ログインしていない場合、LINEクライアント内でのみログインを試みる
          if (liff.isInClient()) {
            liff.login();
          }
        }
      })
      .catch((err) => {
        console.error('LIFF Init Error:', err);
        setMessage('LIFFの初期化に失敗しました。LINEアプリで開いてください。');
      });
  }, []);

  // フォーム送信処理
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // ★★★ 修正ポイント１：PCブラウザテスト用の仮ユーザーID ★★★
    const finalUserId = userId || 'pc-test-user'; // LIFFでIDが取れない場合(PC)は仮IDを使う
    
    setIsSubmitting(true);
    setMessage('データを送信中です...');

    const formData = new FormData(event.currentTarget);
    const data = {
      userId: finalUserId,
      age: formData.get('age'),
      height: formData.get('height'),
      weight: formData.get('weight'),
      targetWeight: formData.get('target-weight'),
      goal: formData.get('goal'),
    };

    try {
      const response = await fetch('/api/submit-counseling', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        // エラーレスポンスの内容を読み取る
        const errorData = await response.json();
        throw new Error(errorData.error || 'サーバーでエラーが発生しました。');
      }

      // ★★★ 修正ポイント２：ウィンドウを閉じる処理の分岐 ★★★
      if (liff.isInClient()) {
        alert('登録が完了しました！');
        liff.closeWindow();
      } else {
        setMessage('PCブラウザでのテスト送信が成功しました！Firestoreを確認してください。');
        alert('テスト送信成功！Firestoreを確認してください。');
      }

    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : '不明なエラーです。';
      setMessage(`送信に失敗しました：${errorMessage}`);
      alert(`送信に失敗しました：${errorMessage}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '20px', maxWidth: '600px', margin: 'auto' }}>
      <h1 style={{ textAlign: 'center' }}>カウンセリング</h1>
      <p style={{ textAlign: 'center', color: 'gray' }}>{message}</p>
      
      <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
        {/* フォームの中身は変更なし */}
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="age">年齢</label>
          <input type="number" id="age" name="age" required style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="height">身長 (cm)</label>
          <input type="number" id="height" name="height" required style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="weight">現在の体重 (kg)</label>
          <input type="number" step="0.1" id="weight" name="weight" required style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="target-weight">目標体重 (kg)</label>
          <input type="number" step="0.1" id="target-weight" name="target-weight" required style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: '15px' }}>
          <label htmlFor="goal">目標（例：ダイエット）</label>
          <input type="text" id="goal" name="goal" required style={{ width: '100%', padding: '10px', boxSizing: 'border-box' }} />
        </div>
        
        <button type="submit" disabled={isSubmitting} style={{ width: '100%', padding: '12px', backgroundColor: isSubmitting ? '#ccc' : '#00b900', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '16px' }}>
          {isSubmitting ? '送信中...' : '送信する'}
        </button>
      </form>
    </main>
  );
}