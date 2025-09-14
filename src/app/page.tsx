"use client";

import { useEffect, useState, FormEvent } from 'react';
import liff from '@line/liff';

type UserData = { age: number; height: number; currentWeight: number; targetWeight: number; goal: string; };
type MealData = { text: string; timestamp: string; type: string; }; // timestampをstringに変更

const API_BASE_URL = '/api';
const LIFF_ID = '2007945061-DEEaglg8';

// --- 部品１：カウンセリングフォーム ---
const CounselingForm = ({ userId, onFormSubmit }: { userId: string; onFormSubmit: (newUserData: UserData) => void }) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    const formData = new FormData(event.currentTarget);
    const data = { userId, age: formData.get('age'), height: formData.get('height'), weight: formData.get('weight'), targetWeight: formData.get('target-weight'), goal: formData.get('goal') };
    try {
      // カウンセリングの送信先はPythonバックエンド
      const response = await fetch('https://us-central1-kota-kun-ai.cloudfunctions.net/kota-kun-final-bot/submit-counseling', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      if (!response.ok) throw new Error('サーバーエラー');
      const newUserData: UserData = { age: Number(data.age), height: Number(data.height), currentWeight: Number(data.weight), targetWeight: Number(data.targetWeight), goal: data.goal as string };
      onFormSubmit(newUserData);
    } catch (error) {
      alert('送信に失敗しました。');
      console.error(error);
      setIsSubmitting(false);
    }
  };
  return (
    <form onSubmit={handleSubmit} style={{ marginTop: '20px' }}>
      {/* ... フォームの見た目は変更なし ... */}
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
  );
};

// --- 部品２：マイページ ---
const MyPage = ({ userData, meals }: { userData: UserData; meals: MealData[] }) => {
  return (
    <div style={{ marginTop: '20px' }}>
      <div style={{ padding: '15px', border: '1px solid #eee', borderRadius: '5px' }}>
        <h3>あなたのデータ</h3>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li><strong>年齢:</strong> {userData.age} 歳</li>
          <li><strong>身長:</strong> {userData.height} cm</li>
          <li><strong>現在の体重:</strong> {userData.currentWeight} kg</li>
          <li><strong>目標体重:</strong> {userData.targetWeight} kg</li>
          <li><strong>目標:</strong> {userData.goal}</li>
        </ul>
      </div>
      <div style={{ marginTop: '20px', padding: '15px', border: '1px solid #eee', borderRadius: '5px' }}>
        <h3>最近の食事記録</h3>
        {meals.length > 0 ? (
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {meals.map((meal, index) => (
              <li key={index} style={{ borderBottom: '1px solid #eee', padding: '10px 0' }}>
                {new Date(meal.timestamp).toLocaleString('ja-JP')}
                <p style={{ margin: '5px 0 0 0' }}>{meal.text}</p>
              </li>
            ))}
          </ul>
        ) : <p>まだ食事の記録がありません。</p>}
      </div>
    </div>
  );
};

// --- LIFFページの本体（司令塔） ---
export default function LiffEntryPage() {
  const [liffState, setLiffState] = useState<'loading' | 'counseling' | 'myPage'>('loading');
  const [userId, setUserId] = useState('');
  const [userData, setUserData] = useState<UserData | null>(null);
  const [meals, setMeals] = useState<MealData[]>([]);

  const checkUserRegistration = (currentUserId: string) => {
    // Vercel上のドアマンに問い合わせる
    fetch(`${API_BASE_URL}/get-user-status?userId=${currentUserId}`)
      .then(res => res.json())
      .then(result => {
        if (result.isRegistered) {
          setUserData(result.userData);
          setMeals(result.meals || []);
          setLiffState('myPage');
        } else {
          setLiffState('counseling');
        }
      });
  };

  useEffect(() => {
    liff.init({ liffId: LIFF_ID })
      .then(() => {
        if (liff.isLoggedIn()) {
          liff.getProfile().then(profile => {
            setUserId(profile.userId);
            checkUserRegistration(profile.userId);
          });
        }
      });
  }, []);
  
  if (liffState === 'loading') return <p>読み込み中...</p>;

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '20px', maxWidth: '600px', margin: 'auto' }}>
      <h1 style={{ textAlign: 'center' }}>AIパーソナルコーチ</h1>
      {liffState === 'counseling' && <CounselingForm userId={userId} onFormSubmit={(newUserData) => { setUserData(newUserData); setLiffState('myPage'); liff.closeWindow(); }} />}
      {liffState === 'myPage' && userData && <MyPage userData={userData} meals={meals} />}
    </main>
  );
}