from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import joblib
import xgboost as xgb

app = Flask(__name__)
# 允許跨來源資源共享 (CORS)，讓網頁可以呼叫這個 API
CORS(app)

# 1. 載入訓練好的模型
# 請確保 'churn_model_bank.pkl' 跟此程式在同一目錄下
try:
    model = joblib.load('churn_model_bank.pkl')
    print("模型載入成功！")
except Exception as e:
    print(f"模型載入失敗，請確認檔案是否存在: {e}")
    model = None

@app.route('/predict', methods=['POST'])
def predict():
    if not model:
        return jsonify({'error': '模型未載入'}), 500

    # 2. 接收前端傳來的 JSON 資料
    data = request.get_json()
    
    # 3. 將資料轉換為 DataFrame (需對應 train.csv 的欄位名稱)
    # 前端傳來的 key 名稱 (例如 creditScore) 需要對應到模型訓練時的特徵名稱 (例如 CreditScore)
    input_data = pd.DataFrame([{
        'CreditScore': int(data.get('creditScore')),
        'Geography': str(data.get('geography')),
        'Gender': str(data.get('gender')),
        'Age': int(data.get('age')),
        'Tenure': int(data.get('tenure')),
        'Balance': float(data.get('balance')),
        'NumOfProducts': int(data.get('numOfProducts')),
        'HasCrCard': int(1 if data.get('hasCrCard') else 0),
        'IsActiveMember': int(1 if data.get('active') else 0),
        'EstimatedSalary': float(data.get('salary'))
    }])

    # 4. 資料預處理
    # XGBoost 設置 enable_categorical=True 時，需要將類別欄位轉為 category 型態
    cat_cols = ['Geography', 'Gender']
    for col in cat_cols:
        input_data[col] = input_data[col].astype('category')

    # 5. 進行預測
    try:
        # predict_proba 會回傳 [[不流失機率, 流失機率]]
        probability = model.predict_proba(input_data)[0][1]
        
        # 回傳結果給前端
        return jsonify({
            'probability': float(probability),
            'message': 'Prediction successful'
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # 啟動伺服器，預設 Port 為 5000
    app.run(debug=True, port=5000)



