import os
import numpy as np  # 新增: 特徵工程需要用到
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import joblib
import xgboost as xgb

app = Flask(__name__)
CORS(app)

# 全域變數存放模型
model = None

# ==========================================
# 1. 補上特徵工程類別 (從 Notebook 複製過來)
# ==========================================
class FeatureEngineer:
    @staticmethod
    def map_columns(df: pd.DataFrame, mappings: dict) -> pd.DataFrame:
        df_copy = df.copy()
        for col, mapping in mappings.items():
            if col in df_copy.columns:
                df_copy[col] = df_copy[col].map(mapping)
        return df_copy

    @staticmethod
    def cast_columns(df: pd.DataFrame, int_cols=None, cat_cols=None) -> pd.DataFrame:
        df_copy = df.copy()
        if int_cols:
            for col in int_cols:
                if col in df_copy.columns:
                    df_copy[col] = df_copy[col].astype(int)
        if cat_cols:
            for col in cat_cols:
                if col in df_copy.columns:
                    df_copy[col] = df_copy[col].astype('category')
        return df_copy

    @staticmethod
    def run_v1_preprocessing(df: pd.DataFrame, is_train: bool) -> pd.DataFrame:
        df_copy = df.copy()
        gender_map = {'Male': 0, 'Female': 1}
        df_copy = FeatureEngineer.map_columns(df_copy, {'Gender': gender_map})

        # 年齡分箱
        df_copy['Age_bin'] = pd.cut(df_copy['Age'], bins=[0, 25, 35, 45, 60, np.inf],
                                    labels=['very_young', 'young', 'mid', 'mature', 'senior'])

        # 創建基礎特徵旗標
        df_copy['Is_two_products'] = (df_copy['NumOfProducts'] == 2)
        df_copy['Germany_Female'] = ((df_copy['Geography'] == 'Germany') & (df_copy['Gender'] == 1))
        df_copy['Germany_Inactive'] = ((df_copy['Geography'] == 'Germany') & (df_copy['IsActiveMember'] == 0))
        df_copy['Has_Zero_Balance'] = (df_copy['Balance'] == 0)

        # 對 Tenure 進行 Log 轉換
        df_copy['Tenure_log'] = np.log1p(df_copy['Tenure'])

        int_cols = ['HasCrCard', 'IsActiveMember', 'NumOfProducts', 'Is_two_products', 'Has_Zero_Balance',
                    'Germany_Female', 'Germany_Inactive']
        
        # 修正: 確保 id 也是 int (如果存在)
        if 'id' in df_copy.columns:
            int_cols.append('id')

        cat_cols = ['Geography', 'Age_bin']

        df_copy = FeatureEngineer.cast_columns(df_copy, int_cols=int_cols, cat_cols=cat_cols)

        # 這裡不 drop 'id'，因為模型訓練時好像有用到它
        cols_to_drop = ['CustomerId', 'Tenure', 'Surname']
        if is_train and 'Exited' in df_copy.columns:
            cols_to_drop.append('Exited')

        df_copy.drop(columns=[col for col in cols_to_drop if col in df_copy.columns], inplace=True, errors='ignore')
        return df_copy

    @staticmethod
    def run_v2_preprocessing(df: pd.DataFrame, is_train: bool) -> pd.DataFrame:
        # 使用 V1 管道作為基礎
        df_copy = FeatureEngineer.run_v1_preprocessing(df, is_train=is_train)

        # 創建新的交互特徵
        df_copy['is_mature_inactive_transit'] = (
                (df_copy['Has_Zero_Balance'] == 1) & (df_copy['IsActiveMember'] == 0) & (
                df_copy['Age'] > 40)).astype(int)

        if is_train and 'Exited' in df_copy.columns:
            df_copy.drop(columns=['Exited'], inplace=True, errors='ignore')

        return df_copy

# ==========================================
# 2. 模型載入邏輯
# ==========================================
def load_model():
    global model
    try:
        model_path = 'churn_model_bank.pkl'
        if os.path.exists(model_path):
            model = joblib.load(model_path)
            print("✅ 模型載入成功！")
        else:
            print(f"❌ 找不到模型檔案: {model_path}")
    except Exception as e:
        print(f"❌ 模型載入發生錯誤: {str(e)}")

load_model()

@app.route('/', methods=['GET'])
def home():
    return "Bank AI Backend with Feature Engineering is Running!"

@app.route('/predict', methods=['POST'])
def predict():
    global model
    if not model:
        load_model()
        if not model:
            return jsonify({'error': 'Model not loaded'}), 500

    try:
        # 1. 接收資料
        data = request.get_json()
        
        # 2. 轉換為 DataFrame (這是原始輸入)
        # 注意：我們補上了一個假的 'id'，因為訓練時沒把 id 刪掉，模型會跟我們要
        raw_df = pd.DataFrame([{
            'id': 0,  # 補上假 ID 以符合模型需求
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

        # 3. 關鍵步驟：執行特徵工程 (把原始資料變成模型看得懂的加工資料)
        print("正在執行特徵工程...")
        processed_data = FeatureEngineer.run_v2_preprocessing(raw_df, is_train=False)
        
        # 除錯用：印出欄位名稱確認是否對齊
        print(f"處理後欄位: {processed_data.columns.tolist()}")

        # 4. 預測
        probability = model.predict_proba(processed_data)[0][1]
        
        return jsonify({
            'probability': float(probability),
            'status': 'success'
        })

    except Exception as e:
        print(f"Prediction Error: {str(e)}")
        # 回傳詳細錯誤給前端以便除錯
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)