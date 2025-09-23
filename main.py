from flask import Flask, request, jsonify
from linebot import LineBotApi, WebhookHandler
from linebot.models import MessageEvent, TextMessage, TextSendMessage, ImageMessage, QuickReply, QuickReplyButton, MessageAction, CameraAction, FollowEvent, FlexSendMessage, BubbleContainer, BoxComponent, TextComponent, SeparatorComponent, ButtonComponent, URIAction
from linebot.exceptions import InvalidSignatureError
import os
import json
import requests
from google.cloud import firestore
from google.cloud import vision
import google.generativeai as genai
from datetime import datetime
import traceback

app = Flask(__name__)

# LINE Bot設定
line_bot_api = LineBotApi(os.environ.get('LINE_CHANNEL_ACCESS_TOKEN', 'sCf/zZSQdEioCsdBjdj3sNg0BvrWiqw3zruTcwFNTdtlDw02x45w/QEg8vbWEs9EazSiS1UziVKoz6p75foPbnaiNFxgCBUerBr1s+969C6IVrvVEaDt0FPYFWNEH6Qtczqf3E495P0QmkV0altlEQdB04t89/1O/w1cDnyilFU='))
handler = WebhookHandler(os.environ.get('LINE_CHANNEL_SECRET', '88779957b5120a3d043e922e1626652a'))

# Firestore設定
db = firestore.Client()

# Gemini AI設定
genai.configure(api_key=os.environ.get('GEMINI_API_KEY', 'AIzaSyBQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQ'))
model = genai.GenerativeModel('gemini-pro')

# Vision API設定
vision_client = vision.ImageAnnotatorClient()

@app.route('/webhook', methods=['POST'])
def webhook():
    signature = request.headers['X-Line-Signature']
    body = request.get_data(as_text=True)
    
    try:
        handler.handle(body, signature)
    except InvalidSignatureError:
        print("Invalid signature. Please check your channel access token/channel secret.")
        abort(400)
    
    return 'OK'

@handler.add(FollowEvent)
def handle_follow(event):
    user_id = event.source.user_id
    user_ref = db.collection('users').document(user_id)
    user_doc = user_ref.get()
    
    if not user_doc.exists:
        welcome_message = TextSendMessage(
            text='こんにちは！AIパーソナルコーチへようこそ！🎉\n\nまずは簡単なカウンセリングをさせていただきます。\n\n「カウンセリング開始」と送信してください。'
        )
        line_bot_api.reply_message(event.reply_token, welcome_message)

@handler.add(MessageEvent, message=TextMessage)
def handle_text_message(event):
    text = event.message.text
    user_id = event.source.user_id
    user_ref = db.collection('users').document(user_id)
    user_doc = user_ref.get()
    
    if not user_doc.exists:
        return
    
    user_data = user_doc.to_dict()
    state = user_data.get('conversation_state', '')
    context = user_data.get('context', {})
    
    # カウンセリング開始
    if text == 'カウンセリング開始':
        user_ref.set({'conversation_state': 'waiting_for_age'}, merge=True)
        line_bot_api.reply_message(
            event.reply_token,
            TextSendMessage(text='ありがとうございます！\n\nまずは年齢を教えてください。')
        )
        return
    
    # 年齢入力
    if state == 'waiting_for_age':
        try:
            age = int(text)
            context['age'] = age
            user_ref.update({
                'conversation_state': 'waiting_for_height',
                'context': context
            })
            line_bot_api.reply_message(
                event.reply_token,
                TextSendMessage(text='ありがとうございます！\n\n次に身長を教えてください（cm）。')
            )
        except ValueError:
            line_bot_api.reply_message(
                event.reply_token,
                TextSendMessage(text='数字で入力してください。')
            )
        return
    
    # 身長入力
    if state == 'waiting_for_height':
        try:
            height = int(text)
            context['height'] = height
            user_ref.update({
                'conversation_state': 'waiting_for_weight',
                'context': context
            })
            line_bot_api.reply_message(
                event.reply_token,
                TextSendMessage(text='ありがとうございます！\n\n現在の体重を教えてください（kg）。')
            )
        except ValueError:
            line_bot_api.reply_message(
                event.reply_token,
                TextSendMessage(text='数字で入力してください。')
            )
        return
    
    # 体重入力
    if state == 'waiting_for_weight':
        try:
            weight = float(text)
            context['currentWeight'] = weight
            user_ref.update({
                'conversation_state': 'waiting_for_target_weight',
                'context': context
            })
            line_bot_api.reply_message(
                event.reply_token,
                TextSendMessage(text='ありがとうございます！\n\n目標体重を教えてください（kg）。')
            )
        except ValueError:
            line_bot_api.reply_message(
                event.reply_token,
                TextSendMessage(text='数字で入力してください。')
            )
        return
    
    # 目標体重入力
    if state == 'waiting_for_target_weight':
        try:
            target_weight = float(text)
            context['targetWeight'] = target_weight
            user_ref.update({
                'conversation_state': 'waiting_for_goal',
                'context': context
            })
            line_bot_api.reply_message(
                event.reply_token,
                TextSendMessage(text='ありがとうございます！\n\n最後に目標を教えてください（例：ダイエット、筋肉増量など）。')
            )
        except ValueError:
            line_bot_api.reply_message(
                event.reply_token,
                TextSendMessage(text='数字で入力してください。')
            )
        return
    
    # 目標入力
    if state == 'waiting_for_goal':
        goal = text
        context['goal'] = goal
        complete_counseling(user_id, context, event.reply_token)
        user_ref.update({
            'conversation_state': firestore.DELETE_FIELD,
            'context': firestore.DELETE_FIELD
        })
        return

@handler.add(MessageEvent, message=ImageMessage)
def handle_image_message(event):
    user_id = event.source.user_id
    message_id = event.message.id
    
    # 画像を取得
    message_content = line_bot_api.get_message_content(message_id)
    
    # 画像を一時ファイルに保存
    with open(f'/tmp/{message_id}.jpg', 'wb') as f:
        for chunk in message_content.iter_content():
            f.write(chunk)
    
    # Vision APIで画像分析
    with open(f'/tmp/{message_id}.jpg', 'rb') as image_file:
        content = image_file.read()
    
    image = vision.Image(content=content)
    response = vision_client.label_detection(image=image)
    labels = response.label_annotations
    
    # 食事関連のラベルを抽出
    food_labels = []
    for label in labels:
        if any(keyword in label.description.lower() for keyword in ['food', 'meal', 'dish', 'plate', 'bowl', 'rice', 'noodle', 'bread', 'meat', 'fish', 'vegetable', 'fruit']):
            food_labels.append(label.description)
    
    if food_labels:
        # 食事の内容を推測
        meal_content = ', '.join(food_labels[:3])  # 上位3つを取得
        
        # カロリーとPFCを推定
        analysis = analyze_meal_with_ai(meal_content)
        
        # 食事記録を保存
        meal_data = {
            'user_id': user_id,
            'meal_type': 'image',
            'content': meal_content,
            'estimated_calories': analysis['calories'],
            'carbs': analysis['carbs'],
            'protein': analysis['protein'],
            'fat': analysis['fat'],
            'analysis': analysis['advice'],
            'timestamp': datetime.now()
        }
        db.collection('meals').add(meal_data)
        
        # Flexメッセージで結果を送信
        flex_message = create_meal_flex_message('image', meal_content, analysis)
        line_bot_api.reply_message(event.reply_token, flex_message)
    else:
        line_bot_api.reply_message(
            event.reply_token,
            TextSendMessage(text='食事の画像を認識できませんでした。もう一度送信してください。')
        )

def complete_counseling(user_id, context, reply_token):
    """カウンセリング完了処理"""
    try:
        # ユーザーデータを保存
        user_data = {
            'age': context['age'],
            'height': context['height'],
            'currentWeight': context['currentWeight'],
            'targetWeight': context['targetWeight'],
            'goal': context['goal'],
            'createdAt': datetime.now(),
            'isRegistered': True
        }
        db.collection('users').document(user_id).set(user_data, merge=True)
        
        # BMI計算
        bmi = context['currentWeight'] / ((context['height'] / 100) ** 2)
        
        # AIアドバイス生成
        advice = generate_ai_advice(context, bmi)
        
        # Flexメッセージで結果を送信
        flex_message = create_counseling_flex_message(context, bmi, advice)
        line_bot_api.reply_message(reply_token, flex_message)
        
    except Exception as e:
        print(f"Error in complete_counseling: {e}")
        traceback.print_exc()
        line_bot_api.reply_message(
            reply_token,
            TextSendMessage(text='カウンセリングの完了に失敗しました。もう一度お試しください。')
        )

def generate_ai_advice(context, bmi):
    """AIアドバイス生成"""
    try:
        prompt = f"""
        以下のユーザー情報に基づいて、パーソナルなアドバイスを生成してください：
        
        年齢: {context['age']}歳
        身長: {context['height']}cm
        現在の体重: {context['currentWeight']}kg
        目標体重: {context['targetWeight']}kg
        目標: {context['goal']}
        BMI: {bmi:.1f}
        
        以下の形式で回答してください：
        1. 現在の状況分析
        2. 目標達成のための具体的なアドバイス
        3. 食事のアドバイス
        4. 運動のアドバイス
        5. モチベーション維持のコツ
        
        簡潔で実用的なアドバイスを心がけてください。
        """
        
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"Error generating AI advice: {e}")
        return "AIアドバイスの生成に失敗しました。基本的な健康管理を心がけてください。"

def analyze_meal_with_ai(meal_content):
    """食事のAI分析"""
    try:
        prompt = f"""
        以下の食事内容を分析して、カロリーとPFC（タンパク質・脂質・炭水化物）を推定してください：
        
        食事内容: {meal_content}
        
        以下の形式で回答してください：
        カロリー: [推定カロリー]kcal
        タンパク質: [推定値]g
        脂質: [推定値]g
        炭水化物: [推定値]g
        アドバイス: [簡潔なアドバイス]
        
        現実的な数値で回答してください。
        """
        
        response = model.generate_content(prompt)
        analysis_text = response.text
        
        # 数値を抽出
        calories = extract_number(analysis_text, 'カロリー')
        protein = extract_number(analysis_text, 'タンパク質')
        fat = extract_number(analysis_text, '脂質')
        carbs = extract_number(analysis_text, '炭水化物')
        
        return {
            'calories': calories,
            'protein': protein,
            'fat': fat,
            'carbs': carbs,
            'advice': analysis_text
        }
    except Exception as e:
        print(f"Error analyzing meal: {e}")
        return {
            'calories': 300,
            'protein': 15,
            'fat': 10,
            'carbs': 40,
            'advice': '食事の分析に失敗しました。バランスの良い食事を心がけてください。'
        }

def extract_number(text, keyword):
    """テキストから数値を抽出"""
    try:
        lines = text.split('\n')
        for line in lines:
            if keyword in line:
                import re
                numbers = re.findall(r'\d+', line)
                if numbers:
                    return int(numbers[0])
        return 0
    except:
        return 0

def create_counseling_flex_message(context, bmi, advice):
    """カウンセリング完了のFlexメッセージ"""
    return FlexSendMessage(
        alt_text='カウンセリング完了！',
        contents=BubbleContainer(
            body=BoxComponent(
                layout='vertical',
                contents=[
                    TextComponent(text='カウンセリング完了！', weight='bold', size='xl'),
                    TextComponent(text=f'BMI: {bmi:.1f}', size='lg'),
                    SeparatorComponent(margin='md'),
                    TextComponent(text='AIアドバイス', weight='bold', size='md'),
                    TextComponent(text=advice[:200] + '...', wrap=True, margin='sm')
                ]
            ),
            footer=BoxComponent(
                layout='vertical',
                contents=[
                    ButtonComponent(
                        style='primary',
                        height='sm',
                        action=URIAction(
                            label='マイページを開く',
                            uri='https://liff.line.me/2007945061-DEEaglg8'
                        )
                    )
                ]
            )
        )
    )

def create_meal_flex_message(meal_type, content, analysis):
    """食事分析のFlexメッセージ"""
    return FlexSendMessage(
        alt_text='食事分析結果',
        contents=BubbleContainer(
            body=BoxComponent(
                layout='vertical',
                contents=[
                    TextComponent(text='食事分析結果', weight='bold', size='xl'),
                    TextComponent(text=content, wrap=True, margin='md'),
                    SeparatorComponent(margin='md'),
                    TextComponent(text=f'カロリー: {analysis["calories"]}kcal', size='md'),
                    TextComponent(text=f'タンパク質: {analysis["protein"]}g', size='md'),
                    TextComponent(text=f'脂質: {analysis["fat"]}g', size='md'),
                    TextComponent(text=f'炭水化物: {analysis["carbs"]}g', size='md'),
                    SeparatorComponent(margin='md'),
                    TextComponent(text='アドバイス', weight='bold', size='md'),
                    TextComponent(text=analysis['advice'][:150] + '...', wrap=True, margin='sm')
                ]
            )
        )
    )

@app.route('/submit-counseling', methods=['POST'])
def submit_counseling():
    """LIFFからのカウンセリングデータ受信（互換性のため残す）"""
    try:
        data = request.get_json()
        user_id = data.get('userId')
        
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
        
        user_data = {
            'age': int(data.get('age')),
            'height': int(data.get('height')),
            'currentWeight': float(data.get('weight')),
            'targetWeight': float(data.get('targetWeight')),
            'goal': data.get('goal'),
            'createdAt': datetime.now(),
            'isRegistered': True
        }
        
        db.collection('users').document(user_id).set(user_data, merge=True)
        
        return jsonify({'message': 'Success'})
        
    except Exception as e:
        print(f"Error in submit_counseling: {e}")
        return jsonify({'error': 'Failed to save data'}), 500

@app.route('/send-counseling-advice', methods=['POST', 'OPTIONS'])
def send_counseling_advice():
    """カウンセリング完了後にLINEでAIアドバイスを送信"""
    # CORS設定
    if request.method == 'OPTIONS':
        response = jsonify({'status': 'OK'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
    
    try:
        data = request.get_json()
        user_id = data.get('userId')
        
        if not user_id:
            return jsonify({'error': 'User ID is required'}), 400
        
        print(f"Sending counseling advice to user: {user_id}")
        
        # 新しいusersコレクションからユーザーデータを取得
        user_ref = db.collection('users').document(user_id)
        user_doc = user_ref.get()
        
        if not user_doc.exists:
            # テスト用のダミーデータを使用（pc-test-userの場合）
            if user_id == 'pc-test-user':
                print("Using dummy data for pc-test-user")
                user_data = {
                    'profile': {
                        'name': 'テストユーザー',
                        'age': 25,
                        'gender': '男性',
                        'height': 170,
                        'weight': 65.0,
                        'targetWeight': 60.0
                    },
                    'preferences': {
                        'targetDate': '2025-12-31',
                        'sleepHours': '7-8時間',
                        'activityLevel': '軽い活動'
                    },
                    'habits': {
                        'hasExerciseHabit': 'いいえ',
                        'exerciseFrequency': '',
                        'mealCount': '3回',
                        'snackFrequency': '週1-2回',
                        'drinkFrequency': '飲まない'
                    },
                    'goals': {
                        'concernedAreas': 'お腹周り',
                        'goal': 'ダイエット'
                    }
                }
            else:
                return jsonify({'error': 'User data not found'}), 404
        else:
            user_data = user_doc.to_dict()
            
        print(f"User data found: {user_data}")
        
        # BMI計算
        height_m = user_data['profile']['height'] / 100
        weight = user_data['profile']['weight']
        bmi = weight / (height_m ** 2)
        
        # AIアドバイス生成
        advice = generate_advanced_ai_advice(user_data, bmi)
        
        # テストユーザーの場合はLINE送信をスキップ
        if user_id == 'pc-test-user':
            print(f"Test mode: Skipping LINE message for {user_id}")
            response = jsonify({
                'message': 'Test advice generated successfully', 
                'advice': advice,
                'bmi': round(bmi, 1),
                'test_mode': True
            })
        else:
            # 実際のLINE userIdの場合はFlexメッセージを作成してLINEで送信
            flex_message = create_advanced_counseling_flex_message(user_data, bmi, advice)
            line_bot_api.push_message(user_id, flex_message)
            print(f"Counseling advice sent successfully to {user_id}")
            response = jsonify({'message': 'Advice sent successfully'})
        
        # CORS設定
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response
        
    except Exception as e:
        print(f"Error in send_counseling_advice: {e}")
        traceback.print_exc()
        response = jsonify({'error': 'Failed to send advice'})
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
        response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
        return response, 500

def generate_advanced_ai_advice(user_data, bmi):
    """新しいユーザーデータ構造に対応したAIアドバイス生成"""
    try:
        profile = user_data.get('profile', {})
        preferences = user_data.get('preferences', {})
        habits = user_data.get('habits', {})
        goals = user_data.get('goals', {})
        
        # プロンプト作成
        prompt = f"""
        ユーザーのカウンセリングデータを分析して、パーソナライズされたアドバイスを提供してください。

        【基本情報】
        - 年齢: {profile.get('age')}歳
        - 性別: {profile.get('gender')}
        - 身長: {profile.get('height')}cm
        - 現在の体重: {profile.get('weight')}kg
        - 目標体重: {profile.get('targetWeight')}kg
        - BMI: {bmi:.1f}

        【生活習慣】
        - 睡眠時間: {preferences.get('sleepHours')}
        - 活動レベル: {preferences.get('activityLevel')}
        - 運動習慣: {habits.get('hasExerciseHabit')} ({habits.get('exerciseFrequency')})
        - 食事回数: {habits.get('mealCount')}
        - 間食頻度: {habits.get('snackFrequency')}
        - アルコール: {habits.get('drinkFrequency')}

        【目標】
        - 気になる部位: {goals.get('concernedAreas')}
        - 主な目的: {goals.get('goal')}
        - 目標期限: {preferences.get('targetDate')}

        以下の観点から具体的で実行可能なアドバイスを日本語で提供してください：
        1. 目標達成のための食事改善提案
        2. 運動・活動量の具体的な推奨事項
        3. 生活習慣改善のポイント
        4. 気になる部位へのアプローチ方法

        アドバイスは励ましの気持ちを込めて、300文字以内で簡潔にお願いします。
        """
        
        response = model.generate_content(prompt)
        return response.text
        
    except Exception as e:
        print(f"Error generating AI advice: {e}")
        return "お疲れ様でした！あなたの目標達成に向けて、バランスの良い食事と適度な運動を心がけましょう。一歩ずつ着実に進んでいけば、必ず理想の体型に近づけますよ！💪"

def create_advanced_counseling_flex_message(user_data, bmi, advice):
    """新しいデータ構造に対応したFlexメッセージ作成"""
    profile = user_data.get('profile', {})
    goals = user_data.get('goals', {})
    
    # BMIステータス
    if bmi < 18.5:
        bmi_status = "低体重"
        bmi_color = "#3b82f6"
    elif bmi < 25:
        bmi_status = "普通体重"
        bmi_color = "#10b981"
    elif bmi < 30:
        bmi_status = "肥満(1度)"
        bmi_color = "#f59e0b"
    else:
        bmi_status = "肥満(2度以上)"
        bmi_color = "#ef4444"
    
    return FlexSendMessage(
        alt_text='カウンセリング完了！パーソナルアドバイスをお送りします！',
        contents=BubbleContainer(
            body=BoxComponent(
                layout='vertical',
                contents=[
                    TextComponent(text='🎉 カウンセリング完了！', weight='bold', size='xl', color='#1f2937'),
                    SeparatorComponent(margin='md'),
                    
                    # BMI情報
                    BoxComponent(
                        layout='horizontal',
                        margin='lg',
                        contents=[
                            TextComponent(text='BMI:', weight='bold', size='sm', flex=1, color='#6b7280'),
                            TextComponent(text=f'{bmi:.1f} ({bmi_status})', size='sm', flex=2, color=bmi_color, weight='bold')
                        ]
                    ),
                    
                    # 目標
                    BoxComponent(
                        layout='horizontal',
                        margin='sm',
                        contents=[
                            TextComponent(text='目標:', weight='bold', size='sm', flex=1, color='#6b7280'),
                            TextComponent(text=goals.get('goal', '健康維持'), size='sm', flex=2, color='#1f2937')
                        ]
                    ),
                    
                    SeparatorComponent(margin='lg'),
                    TextComponent(text='🤖 AIパーソナルアドバイス', weight='bold', size='lg', color='#3b82f6'),
                    TextComponent(text=advice, size='sm', color='#374151', wrap=True, margin='md'),
                    
                    SeparatorComponent(margin='lg'),
                    TextComponent(text='マイページで詳細を確認できます！', size='xs', color='#9ca3af', align='center')
                ]
            ),
            footer=BoxComponent(
                layout='vertical',
                contents=[
                    ButtonComponent(
                        action=URIAction(
                            uri='https://kota-kun-ai.web.app'
                        ),
                        style='primary',
                        color='#3b82f6',
                        height='sm',
                        label='マイページを開く'
                    )
                ]
            )
        )
    )

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
