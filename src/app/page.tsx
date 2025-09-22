"use client";

import { useEffect, useState } from 'react';
import liff from '@line/liff';

type UserData = { 
  age: number; 
  height: number; 
  currentWeight: number; 
  targetWeight: number; 
  goal: string; 
};

type MealData = { 
  text: string; 
  timestamp: string; 
  type: string; 
};

export default function CounselingPage() {
  const [message, setMessage] = useState('LIFFの初期化中です...');
  const [userId, setUserId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [meals, setMeals] = useState<MealData[]>([]);
  const [showMyPage, setShowMyPage] = useState(false);

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
            // ユーザーデータをチェック
            checkUserData(profile.userId);
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

  // ユーザーデータをチェックする関数
  const checkUserData = async (currentUserId: string) => {
    try {
      const response = await fetch(`/api/get-user-status?userId=${currentUserId}`);
      const result = await response.json();
      
      if (result.isRegistered) {
        setUserData(result.userData);
        setMeals(result.meals || []);
        setShowMyPage(true);
        setMessage('マイページを表示しています...');
      } else {
        setShowMyPage(false);
        setMessage('ようこそ！あなたの情報を入力してください。');
      }
    } catch (error) {
      console.error('Error checking user data:', error);
      setShowMyPage(false);
    }
  };

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

      // 送信成功後、マイページを表示
      const newUserData: UserData = {
        age: Number(data.age),
        height: Number(data.height),
        currentWeight: Number(data.weight),
        targetWeight: Number(data.targetWeight),
        goal: data.goal as string,
      };
      setUserData(newUserData);
      setShowMyPage(true);
      setMessage('登録が完了しました！');

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

  // マイページコンポーネント
  const MyPage = () => {
    if (!userData) return null;
    
    const bmi = userData.currentWeight / ((userData.height / 100) ** 2);
    
    return (
      <div style={{ marginTop: '20px' }}>
        <h2 style={{ textAlign: 'center', color: '#00b900' }}>マイページ</h2>
        
        {/* ユーザー情報 */}
        <div style={{ padding: '15px', border: '1px solid #eee', borderRadius: '5px', marginBottom: '20px' }}>
          <h3>あなたのデータ</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            <li><strong>年齢:</strong> {userData.age} 歳</li>
            <li><strong>身長:</strong> {userData.height} cm</li>
            <li><strong>現在の体重:</strong> {userData.currentWeight} kg</li>
            <li><strong>目標体重:</strong> {userData.targetWeight} kg</li>
            <li><strong>目標:</strong> {userData.goal}</li>
            <li><strong>BMI:</strong> {bmi.toFixed(1)}</li>
          </ul>
        </div>

        {/* 食事記録 */}
        <div style={{ padding: '15px', border: '1px solid #eee', borderRadius: '5px' }}>
          <h3>最近の食事記録</h3>
          {meals.length > 0 ? (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {meals.map((meal, index) => (
                <li key={index} style={{ borderBottom: '1px solid #eee', padding: '10px 0' }}>
                  <div style={{ fontSize: '12px', color: 'gray' }}>
                    {new Date(meal.timestamp).toLocaleString('ja-JP')}
                  </div>
                  <div style={{ marginTop: '5px' }}>{meal.text}</div>
                </li>
              ))}
            </ul>
          ) : (
            <p style={{ color: 'gray' }}>まだ食事の記録がありません。</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '20px', maxWidth: '600px', margin: 'auto' }}>
      <h1 style={{ textAlign: 'center' }}>AIパーソナルコーチ</h1>
      <p style={{ textAlign: 'center', color: 'gray' }}>{message}</p>
      
      {showMyPage ? (
        <MyPage />
      ) : (
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
      )}
    </main>
  );
}