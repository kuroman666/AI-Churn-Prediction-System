import os
import numpy as np
from flask import Flask, request, jsonify
from flask_cors import CORS
import pandas as pd
import joblib
import xgboost as xgb
import shap

app = Flask(__name__)
CORS(app)

model = None
explainer = None

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
        # 修改後的寫法 (加入 min 限制)
        raw_prob = float(model.predict_proba(df_final)[0][1])
        probability = min(raw_prob, 0.999)  # 強制上限為 0.999 (99.9%)
        shap_values = explainer.shap_values(processed_data)
        if isinstance(shap_values, list): sv = shap_values[1][0]
        else: sv = shap_values[0]
        
        feature_names = processed_data.columns.tolist()
        shap_data = []
        base_value = explainer.expected_value
        if isinstance(base_value, np.ndarray): base_value = float(base_value[0])
        for name, value in zip(feature_names, sv):
            shap_data.append({
                'feature': name, 'impact': float(value), 'value': str(processed_data.iloc[0][name])
            })
        shap_data.sort(key=lambda x: abs(x['impact']), reverse=True)
        shap_data = shap_data[:10]

        return jsonify({'probability': float(probability), 'status': 'success', 'shap_data': shap_data, 'base_value': float(base_value)})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/predict_batch', methods=['POST'])
def predict_batch():
    global model, explainer
    if not model:
        load_model()
        if not model:
            return jsonify({'error': 'Model not loaded'}), 500
    if 'file' not in request.files: return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '': return jsonify({'error': 'No selected file'}), 400

    try:
        df = pd.read_csv(file)
        required_cols = ['CreditScore', 'Geography', 'Gender', 'Age', 'Tenure', 'Balance', 'NumOfProducts', 'HasCrCard', 'IsActiveMember', 'EstimatedSalary']
        if not all(col in df.columns for col in required_cols):
            return jsonify({'error': f'CSV 格式錯誤，缺少必要欄位。需包含: {required_cols}'}), 400
        
        ids = df['CustomerId'] if 'CustomerId' in df.columns else df.index
        surnames = df['Surname'] if 'Surname' in df.columns else [''] * len(df)
        
        # 這裡需要保存一份 processed_data 供後續取值
        processed_data = FeatureEngineer.run_v2_preprocessing(df, is_train=False)
        
        # 確保模型輸入資料正確
        if 'id' in processed_data.columns: processed_data.drop(columns=['id'], inplace=True)
        
        # 修正後的寫法 (與單筆預測邏輯一致)
        raw_probs = model.predict_proba(processed_data)[:, 1]
        probabilities = np.minimum(raw_probs, 0.999) 
        shap_values_matrix = explainer.shap_values(processed_data)
        
        if isinstance(shap_values_matrix, list): shap_values_target = shap_values_matrix[1]
        else: shap_values_target = shap_values_matrix

        feature_names = processed_data.columns.tolist()
        results = []
        
        for i, prob in enumerate(probabilities):
            row_shap_values = shap_values_target[i]
            
            # --- 新增這段：準備詳細的 SHAP 資料供前端繪圖 ---
            shap_details = []
            for name, val in zip(feature_names, row_shap_values):
                # 取得該特徵的實際數值 (轉字串以免 JSON error)
                feature_val = processed_data.iloc[i][name]
                shap_details.append({
                    'feature': name,
                    'impact': float(val),
                    'value': str(feature_val)
                })
            # 排序並只取前 10 名 (減少傳輸量)
            shap_details.sort(key=lambda x: abs(x['impact']), reverse=True)
            shap_details = shap_details[:10]
            # ---------------------------------------------

            # 抓出前三名特徵名稱 (給列表顯示用)
            top_3_features = [item['feature'] for item in shap_details[:3]]
            
            results.append({
                'customerId': int(ids[i]) if 'CustomerId' in df.columns else i,
                'surname': str(surnames[i]),
                'probability': float(prob),
                'important_features': top_3_features,
                'shap_details': shap_details  # <--- 將詳細資料回傳
            })
            
        return jsonify({'status': 'success', 'results': results})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/predict_roi', methods=['POST'])
def predict_roi():
    global model
    if not model: load_model()
    if not model: return jsonify({'error': 'Model not loaded'}), 500
    if 'file' not in request.files: return jsonify({'error': 'No file part'}), 400
    file = request.files['file']
    if file.filename == '': return jsonify({'error': 'No selected file'}), 400

    try:
        retention_cost = float(request.form.get('cost', 500.0))
        success_rate = float(request.form.get('rate', 0.20))
        df = pd.read_csv(file)
        ids = df['CustomerId'] if 'CustomerId' in df.columns else df.index
        surnames = df['Surname'] if 'Surname' in df.columns else [''] * len(df)
        
        processed_data = FeatureEngineer.run_v2_preprocessing(df, is_train=False)
        if 'id' in processed_data.columns: processed_data.drop(columns=['id'], inplace=True)
        probabilities = model.predict_proba(processed_data)[:, 1]

        NIM_RATE, PRODUCT_PROFIT, ACTIVE_CARD_PROFIT, L_MAX = 0.02, 50.0, 30.0, 10.0
        active_card_flag = ((df['HasCrCard'] == 1) & (df['IsActiveMember'] == 1)).astype(int)
        annual_profit = (df['Balance'] * NIM_RATE) + (df['NumOfProducts'] * PRODUCT_PROFIT) + (active_card_flag * ACTIVE_CARD_PROFIT)
        expected_lifespan = np.minimum(1 / np.maximum(probabilities, 1e-6), L_MAX)
        ltv = annual_profit * expected_lifespan
        enr = (ltv * probabilities * success_rate) - retention_cost

        results = []
        actionable_count = 0
        total_roi = 0.0
        total_cost = 0.0
        for i in range(len(df)):
            if enr[i] > 0:
                actionable_count += 1
                total_roi += enr[i]
                total_cost += retention_cost
                results.append({
                    'customerId': int(ids[i]),
                    'surname': str(surnames[i]),
                    'probability': float(probabilities[i]),
                    'ltv': float(ltv[i]),
                    'enr': float(enr[i])
                })
        results.sort(key=lambda x: x['enr'], reverse=True)
        return jsonify({
            'status': 'success',
            'summary': {
                'actionable_count': actionable_count, 'total_roi': total_roi,
                'total_cost': total_cost, 'total_return': total_roi + total_cost,
                'input_cost': retention_cost, 'input_rate': success_rate
            },
            'results': results
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)