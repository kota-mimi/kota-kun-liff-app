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
line_bot_api = LineBotApi('sCf/zZSQdEioCsdBjdj3sNg0BvrWiqw3zruTcwFNTdtlDw02x45w/QEg8vbWEs9EazSiS1UziVKoz6p75foPbnaiNFxgCBUerBr1s+969C6IVrvVEaDt0FPYFWNEH6Qtczqf3E495P0QmkV0altlEQdB04t89/1O/w1cDnyilFU=')
handler = WebhookHandler('88779957b5120a3d043e922e1626652a')

# Firestore設定
db = firestore.Client()

# Gemini AI設定
genai.configure(api_key='AIzaSyBQqQqQqQqQqQqQqQqQqQqQqQqQqQqQqQ')
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
    """LIFFからのカウンセリングデータ受信"""
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

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
