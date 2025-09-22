"use client";

import { useState } from 'react';
import liff from '@line/liff';

type FormData = {
  // Step 1: 基本情報
  name: string;
  age: string;
  gender: string;
  
  // Step 2: 身体情報
  height: string;
  weight: string;
  targetWeight: string;
  targetDate: string;
  
  // Step 3: 生活習慣
  sleepHours: string;
  activityLevel: string;
  
  // Step 4: 運動習慣
  hasExerciseHabit: string;
  exerciseFrequency: string;
  
  // Step 5: 食生活
  mealCount: string;
  snackFrequency: string;
  drinkFrequency: string;
  
  // Step 6: 目標・悩み
  concernedAreas: string;
  goalType: string;
  // その他の入力用
  otherConcernedAreas: string;
  otherGoalType: string;
};

type SelectionButtonProps = {
  value: string;
  currentValue: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
};

function SelectionButton({ value, currentValue, onChange, children }: SelectionButtonProps) {
  const isSelected = currentValue === value;
  
  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      style={{
        width: '100%',
        padding: '16px',
        borderRadius: '12px',
        border: isSelected ? '2px solid #3b82f6' : '2px solid #e5e7eb',
        background: isSelected ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)' : 'white',
        color: isSelected ? 'white' : '#374151',
        fontSize: '16px',
        fontWeight: '500',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: '12px'
      }}
    >
      {children}
    </button>
  );
}

// 完了ページコンポーネント
function CompletionPage({ onRetry, onAdvice }: { onRetry: () => void; onAdvice: () => void }) {
  return (
    <div style={{ 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      minHeight: '100vh',
      padding: '16px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{ maxWidth: '480px', width: '100%' }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
          textAlign: 'center'
        }}>
          <div style={{
            fontSize: '64px',
            marginBottom: '24px'
          }}>✓</div>
          
          <h2 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: '#1f2937',
            marginBottom: '16px'
          }}>カウンセリング完了！</h2>
          
          <p style={{
            color: '#6b7280',
            fontSize: '16px',
            marginBottom: '32px',
            lineHeight: '1.6'
          }}>
            あなたの情報を正常に保存しました。<br />
            次はどちらをご希望ですか？
          </p>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button
              onClick={onAdvice}
              style={{
                width: '100%',
                padding: '18px',
                borderRadius: '12px',
                border: 'none',
                background: 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                color: 'white',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              AIアドバイスをもらう
            </button>
            
            <button
              onClick={onRetry}
              style={{
                width: '100%',
                padding: '18px',
                borderRadius: '12px',
                border: '2px solid #3b82f6',
                background: 'white',
                color: '#3b82f6',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                (e.target as HTMLButtonElement).style.background = '#3b82f6';
                (e.target as HTMLButtonElement).style.color = 'white';
              }}
              onMouseOut={(e) => {
                (e.target as HTMLButtonElement).style.background = 'white';
                (e.target as HTMLButtonElement).style.color = '#3b82f6';
              }}
            >
              もう一度やり直す
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

interface CounselingStepsProps {
  userId?: string;
  onComplete?: () => void;
}

export function CounselingSteps({ userId, onComplete }: CounselingStepsProps = {}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    name: '',
    age: '',
    gender: '',
    height: '',
    weight: '',
    targetWeight: '',
    targetDate: '',
    sleepHours: '',
    activityLevel: '',
    hasExerciseHabit: '',
    exerciseFrequency: '',
    mealCount: '',
    snackFrequency: '',
    drinkFrequency: '',
    concernedAreas: '',
    goalType: '',
    otherConcernedAreas: '',
    otherGoalType: ''
  });

  const updateFormData = (data: Partial<FormData>) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  const nextStep = () => {
    if (currentStep < 6) setCurrentStep(currentStep + 1);
  };

  const prevStep = () => {
    if (currentStep > 1) setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    try {
      // デバッグ用ログ
      console.log('CounselingSteps: userId =', userId);
      console.log('CounselingSteps: using userId =', userId || 'pc-test-user');
      
      const data = {
        userId: userId || 'pc-test-user', // LIFFから取得したuserIdまたはデフォルト
        name: formData.name,
        age: parseInt(formData.age),
        gender: formData.gender,
        height: parseInt(formData.height),
        weight: parseFloat(formData.weight),
        targetWeight: parseFloat(formData.targetWeight),
        targetDate: formData.targetDate,
        sleepHours: formData.sleepHours,
        activityLevel: formData.activityLevel,
        hasExerciseHabit: formData.hasExerciseHabit,
        exerciseFrequency: formData.exerciseFrequency,
        mealCount: formData.mealCount,
        snackFrequency: formData.snackFrequency,
        drinkFrequency: formData.drinkFrequency,
        concernedAreas: formData.concernedAreas === 'その他' ? formData.otherConcernedAreas : formData.concernedAreas,
        goal: formData.goalType === 'その他' ? formData.otherGoalType : formData.goalType
      };

      const response = await fetch('https://us-central1-kota-kun-ai.cloudfunctions.net/saveCounselingData', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('送信に失敗しました');
      }

      // 完了ページを表示
      setIsCompleted(true);
      
      // 完了後コールバックを呼ぶ（少し遅延させてUIを確認できるように）
      if (onComplete) {
        setTimeout(() => {
          onComplete();
        }, 2000);
      }

    } catch (error) {
      console.error(error);
      alert('送信エラーが発生しました。もう一度お試しください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRetry = () => {
    setIsCompleted(false);
    setCurrentStep(1);
    setFormData({
      name: '',
      age: '',
      gender: '',
      height: '',
      weight: '',
      targetWeight: '',
      targetDate: '',
      sleepHours: '',
      activityLevel: '',
      hasExerciseHabit: '',
      exerciseFrequency: '',
      mealCount: '',
      snackFrequency: '',
      drinkFrequency: '',
      concernedAreas: '',
      goalType: '',
      otherConcernedAreas: '',
      otherGoalType: ''
    });
  };

  const handleAdvice = async () => {
    try {
      // AIアドバイスを取得するためのAPI呼び出し
      const response = await fetch('https://kota-kun-ai-8db8eacdbee1.herokuapp.com/send-counseling-advice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: userId || 'pc-test-user' }),
      });

      if (response.ok) {
        if (liff.isInClient()) {
          // LINEアプリ内の場合はウィンドウを閉じる（LINEでアドバイスが送信される）
          liff.closeWindow();
        } else {
          // PCブラウザの場合は成功メッセージを表示
          alert('AIアドバイスをLINEで送信しました！LINEアプリを確認してください。');
        }
      } else {
        throw new Error('AIアドバイスの送信に失敗しました');
      }
    } catch (error) {
      console.error('AIアドバイス送信エラー:', error);
      alert('AIアドバイスの送信に失敗しました。もう一度お試しください。');
    }
  };

  // 完了ページを表示
  if (isCompleted) {
    return <CompletionPage onRetry={handleRetry} onAdvice={handleAdvice} />;
  }

  // プログレス計算
  const progress = (currentStep / 6) * 100;

  // 現在のステップが完了しているかチェック
  const isStepComplete = (step: number) => {
    switch (step) {
      case 1: 
        return formData.name && formData.age && formData.gender;
      case 2: 
        return formData.height && formData.weight && formData.targetWeight && formData.targetDate;
      case 3: 
        return formData.sleepHours && formData.activityLevel;
      case 4: 
        return formData.hasExerciseHabit && (formData.hasExerciseHabit === 'いいえ' || formData.exerciseFrequency);
      case 5: 
        return formData.mealCount && formData.snackFrequency && formData.drinkFrequency;
      case 6: 
        return formData.concernedAreas && formData.goalType && 
               (formData.concernedAreas !== 'その他' || formData.otherConcernedAreas) &&
               (formData.goalType !== 'その他' || formData.otherGoalType);
      default: 
        return false;
    }
  };

  const renderStep = () => {
    const stepStyle = {
      background: 'white',
      borderRadius: '16px',
      padding: '24px',
      boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08)',
      minHeight: '400px'
    };

    const titleStyle = {
      textAlign: 'center' as const,
      fontSize: '24px',
      fontWeight: 'bold',
      color: '#1f2937',
      marginBottom: '8px'
    };

    const subtitleStyle = {
      textAlign: 'center' as const,
      color: '#6b7280',
      fontSize: '16px',
      marginBottom: '32px'
    };

    const inputStyle = {
      width: '100%',
      padding: '16px',
      borderRadius: '12px',
      border: '2px solid #e5e7eb',
      fontSize: '16px',
      outline: 'none',
      transition: 'border-color 0.2s ease',
      marginBottom: '16px'
    };

    switch (currentStep) {
      case 1:
        return (
          <div style={stepStyle}>
            <h2 style={titleStyle}>基本情報</h2>
            <p style={subtitleStyle}>あなたについて教えてください</p>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                お名前
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => updateFormData({ name: e.target.value })}
                placeholder="山田太郎"
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                年齢
              </label>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={formData.age}
                onChange={(e) => updateFormData({ age: e.target.value })}
                placeholder="25"
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', color: '#374151' }}>
                性別
              </label>
              <SelectionButton
                value="男性"
                currentValue={formData.gender}
                onChange={(value) => updateFormData({ gender: value })}
              >
                男性
              </SelectionButton>
              <SelectionButton
                value="女性"
                currentValue={formData.gender}
                onChange={(value) => updateFormData({ gender: value })}
              >
                女性
              </SelectionButton>
              <SelectionButton
                value="その他"
                currentValue={formData.gender}
                onChange={(value) => updateFormData({ gender: value })}
              >
                その他
              </SelectionButton>
            </div>
          </div>
        );

      case 2:
        return (
          <div style={stepStyle}>
            <h2 style={titleStyle}>身体情報</h2>
            <p style={subtitleStyle}>現在の体型と目標を教えてください</p>
            
            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                身長 (cm)
              </label>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                value={formData.height}
                onChange={(e) => updateFormData({ height: e.target.value })}
                placeholder="170"
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                現在の体重 (kg)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={formData.weight}
                onChange={(e) => updateFormData({ weight: e.target.value })}
                placeholder="65.0"
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                目標体重 (kg)
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                value={formData.targetWeight}
                onChange={(e) => updateFormData({ targetWeight: e.target.value })}
                placeholder="60.0"
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600', color: '#374151' }}>
                目標期限
              </label>
              <input
                type="date"
                value={formData.targetDate}
                onChange={(e) => updateFormData({ targetDate: e.target.value })}
                style={inputStyle}
                onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div style={stepStyle}>
            <h2 style={titleStyle}>生活習慣</h2>
            <p style={subtitleStyle}>普段の生活リズムについて教えてください</p>
            
            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', color: '#374151' }}>
                平均睡眠時間
              </label>
              {['5時間未満', '5-6時間', '6-7時間', '7-8時間', '8時間以上'].map((option) => (
                <SelectionButton
                  key={option}
                  value={option}
                  currentValue={formData.sleepHours}
                  onChange={(value) => updateFormData({ sleepHours: value })}
                >
                  {option}
                </SelectionButton>
              ))}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', color: '#374151' }}>
                日常の活動レベル
              </label>
              {['座りがち', '軽い活動', '中程度の活動', '活発', '非常に活発'].map((option) => (
                <SelectionButton
                  key={option}
                  value={option}
                  currentValue={formData.activityLevel}
                  onChange={(value) => updateFormData({ activityLevel: value })}
                >
                  {option}
                </SelectionButton>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div style={stepStyle}>
            <h2 style={titleStyle}>運動習慣</h2>
            <p style={subtitleStyle}>現在の運動について教えてください</p>
            
            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', color: '#374151' }}>
                運動習慣はありますか？
              </label>
              <SelectionButton
                value="はい"
                currentValue={formData.hasExerciseHabit}
                onChange={(value) => updateFormData({ hasExerciseHabit: value })}
              >
                はい
              </SelectionButton>
              <SelectionButton
                value="いいえ"
                currentValue={formData.hasExerciseHabit}
                onChange={(value) => updateFormData({ hasExerciseHabit: value })}
              >
                いいえ
              </SelectionButton>
            </div>

            {formData.hasExerciseHabit === 'はい' && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', color: '#374151' }}>
                  運動頻度
                </label>
                {['週1回', '週2-3回', '週4-5回', '毎日'].map((option) => (
                  <SelectionButton
                    key={option}
                    value={option}
                    currentValue={formData.exerciseFrequency}
                    onChange={(value) => updateFormData({ exerciseFrequency: value })}
                  >
                    {option}
                  </SelectionButton>
                ))}
              </div>
            )}
          </div>
        );

      case 5:
        return (
          <div style={stepStyle}>
            <h2 style={titleStyle}>食生活</h2>
            <p style={subtitleStyle}>普段の食事について教えてください</p>
            
            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', color: '#374151' }}>
                1日の食事回数
              </label>
              {['1回', '2回', '3回', '4回以上'].map((option) => (
                <SelectionButton
                  key={option}
                  value={option}
                  currentValue={formData.mealCount}
                  onChange={(value) => updateFormData({ mealCount: value })}
                >
                  {option}
                </SelectionButton>
              ))}
            </div>

            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', color: '#374151' }}>
                間食の頻度
              </label>
              {['ほとんどしない', '週1-2回', '週3-4回', 'ほぼ毎日'].map((option) => (
                <SelectionButton
                  key={option}
                  value={option}
                  currentValue={formData.snackFrequency}
                  onChange={(value) => updateFormData({ snackFrequency: value })}
                >
                  {option}
                </SelectionButton>
              ))}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', color: '#374151' }}>
                アルコール摂取頻度
              </label>
              {['飲まない', '月1-2回', '週1-2回', '週3-4回', 'ほぼ毎日'].map((option) => (
                <SelectionButton
                  key={option}
                  value={option}
                  currentValue={formData.drinkFrequency}
                  onChange={(value) => updateFormData({ drinkFrequency: value })}
                >
                  {option}
                </SelectionButton>
              ))}
            </div>
          </div>
        );

      case 6:
        return (
          <div style={stepStyle}>
            <h2 style={titleStyle}>目標・悩み</h2>
            <p style={subtitleStyle}>あなたの目標を教えてください</p>
            
            <div style={{ marginBottom: '30px' }}>
              <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', color: '#374151' }}>
                気になる部位
              </label>
              {['お腹周り', '太もも', '二の腕', '顔', '全体的', 'その他'].map((option) => (
                <SelectionButton
                  key={option}
                  value={option}
                  currentValue={formData.concernedAreas}
                  onChange={(value) => {
                    updateFormData({ concernedAreas: value });
                    if (value !== 'その他') {
                      updateFormData({ otherConcernedAreas: '' });
                    }
                  }}
                >
                  {option}
                </SelectionButton>
              ))}
              
              {formData.concernedAreas === 'その他' && (
                <div style={{ marginTop: '16px' }}>
                  <input
                    type="text"
                    value={formData.otherConcernedAreas}
                    onChange={(e) => updateFormData({ otherConcernedAreas: e.target.value })}
                    placeholder="具体的な部位を入力してください"
                    style={{
                      ...inputStyle,
                      marginBottom: '0'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                  />
                </div>
              )}
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '12px', fontWeight: '600', color: '#374151' }}>
                主な目的
              </label>
              {['ダイエット', '筋力アップ', '健康維持', '体力向上', 'ストレス解消', 'その他'].map((option) => (
                <SelectionButton
                  key={option}
                  value={option}
                  currentValue={formData.goalType}
                  onChange={(value) => {
                    updateFormData({ goalType: value });
                    if (value !== 'その他') {
                      updateFormData({ otherGoalType: '' });
                    }
                  }}
                >
                  {option}
                </SelectionButton>
              ))}
              
              {formData.goalType === 'その他' && (
                <div style={{ marginTop: '16px' }}>
                  <input
                    type="text"
                    value={formData.otherGoalType}
                    onChange={(e) => updateFormData({ otherGoalType: e.target.value })}
                    placeholder="具体的な目的を入力してください"
                    style={{
                      ...inputStyle,
                      marginBottom: '0'
                    }}
                    onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
                    onBlur={(e) => e.target.style.borderColor = '#e5e7eb'}
                  />
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div style={{ 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
      minHeight: '100vh',
      padding: '16px'
    }}>
      <div style={{ maxWidth: '480px', margin: '0 auto' }}>
        {/* プログレスバー */}
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '20px',
          marginBottom: '16px',
          boxShadow: '0 2px 12px rgba(0, 0, 0, 0.05)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ color: '#1f2937', fontWeight: '600', fontSize: '16px' }}>ステップ {currentStep} / 6</span>
            <span style={{ color: '#1f2937', fontWeight: '600', fontSize: '18px' }}>{Math.round(progress)}%</span>
          </div>
          <div style={{
            width: '100%',
            height: '8px',
            background: '#f1f5f9',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              background: 'linear-gradient(90deg, #3b82f6 0%, #1d4ed8 100%)',
              borderRadius: '4px',
              width: `${progress}%`,
              transition: 'width 0.4s ease'
            }} />
          </div>
        </div>

        {/* ステップコンテンツ */}
        {renderStep()}

        {/* ナビゲーションボタン */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          {currentStep > 1 && (
            <button
              onClick={prevStep}
              style={{
                flex: 1,
                padding: '16px',
                borderRadius: '12px',
                border: '2px solid #3b82f6',
                background: 'white',
                color: '#3b82f6',
                fontSize: '16px',
                fontWeight: '600',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => {
                (e.target as HTMLButtonElement).style.background = '#3b82f6';
                (e.target as HTMLButtonElement).style.color = 'white';
              }}
              onMouseOut={(e) => {
                (e.target as HTMLButtonElement).style.background = 'white';
                (e.target as HTMLButtonElement).style.color = '#3b82f6';
              }}
            >
              戻る
            </button>
          )}
          
          {currentStep < 6 ? (
            <button
              onClick={nextStep}
              disabled={!isStepComplete(currentStep)}
              style={{
                flex: currentStep === 1 ? 1 : 2,
                padding: '16px',
                borderRadius: '12px',
                border: 'none',
                background: isStepComplete(currentStep) 
                  ? 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)'
                  : '#d1d5db',
                color: 'white',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isStepComplete(currentStep) ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease'
              }}
            >
              次へ
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!isStepComplete(6) || isSubmitting}
              style={{
                flex: 2,
                padding: '16px',
                borderRadius: '12px',
                border: 'none',
                background: isStepComplete(6) && !isSubmitting
                  ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)'
                  : '#d1d5db',
                color: 'white',
                fontSize: '16px',
                fontWeight: '600',
                cursor: isStepComplete(6) && !isSubmitting ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s ease'
              }}
            >
              {isSubmitting ? '送信中...' : '完了'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}