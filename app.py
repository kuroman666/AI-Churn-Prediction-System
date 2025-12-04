import os
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import joblib
import xgboost as xgb
import shap  # 引入 SHAP 套件

app = Flask(__name__)
CORS(app)

model = None
explainer = None  # 用於存放 SHAP 解釋器

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
        df_copy['Age_bin'] = pd.cut(df_copy['Age'], bins=[0, 25, 35, 45, 60, np.inf],
                                    labels=['very_young', 'young', 'mid', 'mature', 'senior'])
        df_copy['Is_two_products'] = (df_copy['NumOfProducts'] == 2)
        df_copy['Germany_Female'] = ((df_copy['Geography'] == 'Germany') & (df_copy['Gender'] == 1))
        df_copy['Germany_Inactive'] = ((df_copy['Geography'] == 'Germany') & (df_copy['IsActiveMember'] == 0))
        df_copy['Has_Zero_Balance'] = (df_copy['Balance'] == 0)
        df_copy['Tenure_log'] = np.log1p(df_copy['Tenure'])
        int_cols = ['HasCrCard', 'IsActiveMember', 'NumOfProducts', 'Is_two_products', 'Has_Zero_Balance',
                    'Germany_Female', 'Germany_Inactive']
        if 'id' in df_copy.columns:
            int_cols.append('id')
        cat_cols = ['Geography', 'Age_bin']
        df_copy = FeatureEngineer.cast_columns(df_copy, int_cols=int_cols, cat_cols=cat_cols)
        cols_to_drop = ['CustomerId', 'Tenure', 'Surname']
        if is_train and 'Exited' in df_copy.columns:
            cols_to_drop.append('Exited')
        df_copy.drop(columns=[col for col in cols_to_drop if col in df_copy.columns], inplace=True, errors='ignore')
        return df_copy

    @staticmethod
    def run_v2_preprocessing(df: pd.DataFrame, is_train: bool) -> pd.DataFrame:
        df_copy = FeatureEngineer.run_v1_preprocessing(df, is_train=is_train)
        df_copy['is_mature_inactive_transit'] = (
                (df_copy['Has_Zero_Balance'] == 1) & (df_copy['IsActiveMember'] == 0) & (
                df_copy['Age'] > 40)).astype(int)
        if is_train and 'Exited' in df_copy.columns:
            df_copy.drop(columns=['Exited'], inplace=True, errors='ignore')
        return df_copy

def load_model():
    global model, explainer
    try:
        model_path = 'churn_model_bank.pkl'
        if os.path.exists(model_path):
            model = joblib.load(model_path)
            # 初始化 SHAP TreeExplainer
            explainer = shap.TreeExplainer(model)
            print("✅ 模型與 SHAP 解釋器載入成功！")
        else:
            print(f"❌ 找不到模型檔案: {model_path}")
    except Exception as e:
        print(f"❌ 模型載入發生錯誤: {str(e)}")

load_model()

@app.route('/', methods=['GET'])
def home():
    return "Bank AI Backend with SHAP is Running!"

@app.route('/predict', methods=['POST'])
def predict():
    global model, explainer
    if not model:
        load_model()
        if not model:
            return jsonify({'error': 'Model not loaded'}), 500

    try:
        data = request.get_json()
        
        raw_df = pd.DataFrame([{
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

        processed_data = FeatureEngineer.run_v2_preprocessing(raw_df, is_train=False)
        
        # 1. 預測機率
        probability = model.predict_proba(processed_data)[0][1]

        # 2. 計算 SHAP 值
        shap_values = explainer.shap_values(processed_data)
        
        if isinstance(shap_values, list):
            sv = shap_values[1][0] 
        else:
            sv = shap_values[0]

        feature_names = processed_data.columns.tolist()
        
        # 3. 整理 SHAP 數據
        shap_data = []
        base_value = explainer.expected_value
        if isinstance(base_value, np.ndarray):
            base_value = float(base_value[0])
            
        for name, value in zip(feature_names, sv):
            shap_data.append({
                'feature': name,
                'impact': float(value),
                'value': str(processed_data.iloc[0][name])
            })

        shap_data.sort(key=lambda x: abs(x['impact']), reverse=True)
        shap_data = shap_data[:10]

        return jsonify({
            'probability': float(probability),
            'status': 'success',
            'shap_data': shap_data,
            'base_value': float(base_value)
        })

    except Exception as e:
        print(f"Prediction Error: {str(e)}")
        return jsonify({'error': str(e)}), 500


@app.route('/predict_batch', methods=['POST'])
def predict_batch():
    global model, explainer
    if not model:
        load_model()
        if not model:
            return jsonify({'error': 'Model not loaded'}), 500

    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    try:
        # 1. 讀取 CSV
        df = pd.read_csv(file)
        
        required_cols = ['CreditScore', 'Geography', 'Gender', 'Age', 'Tenure', 
                         'Balance', 'NumOfProducts', 'HasCrCard', 'IsActiveMember', 'EstimatedSalary']
        
        if not all(col in df.columns for col in required_cols):
            return jsonify({'error': f'CSV 格式錯誤，缺少必要欄位。需包含: {required_cols}'}), 400

        ids = df['CustomerId'] if 'CustomerId' in df.columns else df.index
        surnames = df['Surname'] if 'Surname' in df.columns else [''] * len(df)

        # 2. 前處理
        processed_data = FeatureEngineer.run_v2_preprocessing(df, is_train=False)

        if 'id' in processed_data.columns:
            processed_data.drop(columns=['id'], inplace=True)
        
        # 3. 預測機率
        probabilities = model.predict_proba(processed_data)[:, 1]

        # 4. ★★★ 批量計算 SHAP 值 ★★★
        # 這會回傳一個矩陣 (Rows, Features) 或 List of Matrices
        shap_values_matrix = explainer.shap_values(processed_data)
        
        # 處理 Binary Classification 的 SHAP 格式 (通常會是 list，index 1 代表 positive class)
        if isinstance(shap_values_matrix, list):
            # 取出 Class 1 (流失) 的矩陣
            shap_values_target = shap_values_matrix[1]
        else:
            shap_values_target = shap_values_matrix

        feature_names = processed_data.columns.tolist()
        results = []

        # 5. 整合結果與特徵重要性
        for i, prob in enumerate(probabilities):
            # 取得該客戶的 SHAP 值 (array)
            row_shap_values = shap_values_target[i]
            
            # 將 (特徵名稱, SHAP值) 綁定在一起
            # 我們要找的是 "導致流失的原因"，所以找 SHAP 值為 "正" 且 "最大" 的
            features_with_impact = list(zip(feature_names, row_shap_values))
            
            # 排序：由大到小 (數值越大代表推向流失的力量越強)
            features_with_impact.sort(key=lambda x: x[1], reverse=True)
            
            # 取出前 3 名的特徵名稱
            top_3_features = [item[0] for item in features_with_impact[:3]]

            results.append({
                'customerId': int(ids[i]) if 'CustomerId' in df.columns else i,
                'surname': str(surnames[i]),
                'probability': float(prob),
                'important_features': top_3_features # 回傳前三名流失主因
            })

        return jsonify({
            'status': 'success',
            'results': results
        })

    except Exception as e:
        print(f"Batch Prediction Error: {str(e)}")
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)