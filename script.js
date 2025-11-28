// 初始化 Chart.js 圖表實例
let churnChartInstance = null;

/**
 * ==========================================
 * 功能 1: 銀行客戶流失預測 (Bank Churn) - 串接後端版
 * ==========================================
 */
async function predictChurn() {
    const btn = document.querySelector('.btn-predict');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 分析中...';
    btn.disabled = true;

    // 1. 獲取表單數據 (注意：這裡要抓取所有模型需要的欄位)
    const formData = {
        creditScore: document.getElementById('creditScore').value,
        geography: document.getElementById('geography').value,
        gender: document.getElementById('gender').value,
        age: document.getElementById('age').value,
        tenure: document.getElementById('tenure').value,       // 新增
        balance: document.getElementById('balance').value,
        numOfProducts: document.getElementById('numOfProducts').value, // 新增
        hasCrCard: document.getElementById('hasCrCard').checked,       // 新增
        salary: document.getElementById('salary').value,       // 新增 (EstimatedSalary)
        active: document.getElementById('isActiveMember').checked
    };

    try {
        // 2. 發送 POST 請求給 Python 後端 (app.py)
        // 假設您的 app.py 在本機執行，網址通常是 http://127.0.0.1:5000/predict
        const response = await fetch('http://127.0.0.1:5000/predict', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (response.ok) {
            // 3. 取得後端回傳的真實機率
            const realProbability = result.probability;
            updateUI(realProbability, 'bank', formData);
        } else {
            alert('預測失敗：' + (result.error || '未知錯誤'));
            console.error('Backend error:', result);
        }

    } catch (error) {
        alert('無法連接到後端伺服器，請確認 app.py 是否已啟動。');
        console.error('Connection error:', error);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

/**
 * ==========================================
 * 功能 2: 電信客戶流失預測 (Telecom Churn)
 * 目前維持模擬邏輯，若有訓練好的電信模型，可依樣畫葫蘆建立另一個 API 路由
 * ==========================================
 */
function predictTelecomChurn() {
    // 1. 獲取表單數據
    const formData = {
        gender: document.getElementById('gender').value,
        seniorCitizen: document.getElementById('SeniorCitizen').value,
        partner: document.getElementById('Partner').value,
        dependents: document.getElementById('Dependents').value,
        tenure: parseInt(document.getElementById('tenure').value),
        phoneService: document.getElementById('PhoneService').value,
        multipleLines: document.getElementById('MultipleLines').value,
        internetService: document.getElementById('InternetService').value,
        onlineSecurity: document.getElementById('OnlineSecurity').value,
        onlineBackup: document.getElementById('OnlineBackup').value,
        deviceProtection: document.getElementById('DeviceProtection').value,
        techSupport: document.getElementById('TechSupport').value,
        streamingTV: document.getElementById('StreamingTV').value,
        streamingMovies: document.getElementById('StreamingMovies').value,
        contract: document.getElementById('Contract').value,
        paperlessBilling: document.getElementById('PaperlessBilling').value,
        paymentMethod: document.getElementById('PaymentMethod').value,
        monthlyCharges: parseFloat(document.getElementById('MonthlyCharges').value),
        totalCharges: parseFloat(document.getElementById('TotalCharges').value)
    };

    // 2. 模擬電信 AI 模型邏輯
    let mockProbability = 0.3; 
    if (formData.contract === 'Month-to-month') mockProbability += 0.25; 
    if (formData.contract === 'Two year') mockProbability -= 0.2;     
    if (formData.internetService === 'Fiber optic') mockProbability += 0.15; 
    if (formData.tenure < 12) mockProbability += 0.15; 
    if (formData.tenure > 60) mockProbability -= 0.15; 
    if (formData.monthlyCharges > 100) mockProbability += 0.1; 
    
    mockProbability += (Math.random() * 0.1 - 0.05);
    mockProbability = Math.min(Math.max(mockProbability, 0.05), 0.98);

    updateUI(mockProbability, 'telecom', formData);
}


/**
 * ==========================================
 * 通用 UI 更新函數
 * ==========================================
 */
function updateUI(probability, type, data) {
    const resultSection = document.getElementById('resultSection');
    const probValue = document.getElementById('probValue');
    const riskBadge = document.getElementById('riskBadge');
    const factorsList = document.getElementById('factorsList');
    const suggestionText = document.getElementById('suggestionText');

    resultSection.classList.add('active');

    const percentage = (probability * 100).toFixed(1);
    probValue.innerText = `${percentage}%`;

    let isHighRisk = probability > 0.5;
    let highColor1, highColor2;
    if (type === 'bank') {
        highColor1 = '#f87171'; highColor2 = '#ef4444'; 
    } else {
        highColor1 = '#a855f7'; highColor2 = '#d946ef'; 
    }

    if (isHighRisk) {
        riskBadge.className = 'risk-badge risk-high';
        riskBadge.innerText = '高風險 High Risk';
        probValue.style.background = `linear-gradient(90deg, ${highColor1}, ${highColor2})`;
        probValue.style.webkitBackgroundClip = 'text';
    } else {
        riskBadge.className = 'risk-badge risk-low';
        riskBadge.innerText = '低風險 Low Risk';
        probValue.style.background = 'linear-gradient(90deg, #34d399, #10b981)';
        probValue.style.webkitBackgroundClip = 'text';
    }

    updateChart(probability, isHighRisk);

    let factorsHtml = '';
    
    if (type === 'bank') {
        if (isHighRisk) suggestionText.innerText = "客戶流失風險極高！建議立即指派專員聯繫。";
        else suggestionText.innerText = "客戶狀態穩定。建議維持定期互動。";

        // 前端簡單判斷因子作為示意 (若要精準需由後端傳回 SHAP 值)
        if (data.geography === 'Germany') factorsHtml += createFactor('地理位置 (Germany)', '增加風險', true);
        if (data.age > 45) factorsHtml += createFactor(`年齡 (${data.age})`, '增加風險', true);
        if (!data.active) factorsHtml += createFactor('活躍狀態 (Inactive)', '增加風險', true);
        else factorsHtml += createFactor('活躍狀態 (Active)', '降低風險', false);
        if (data.balance > 100000) factorsHtml += createFactor('資產餘額偏高', '流失可能性增加', true);

    } else {
        if (isHighRisk) suggestionText.innerText = "高風險！建議提供綁約折扣。";
        else suggestionText.innerText = "忠誠用戶。建議推薦家庭方案。";

        if (data.contract === 'Month-to-month') factorsHtml += createFactor('合約 (按月付費)', '增加風險', true);
        else if (data.contract === 'Two year') factorsHtml += createFactor('合約 (兩年)', '降低風險', false);
        if (data.internetService === 'Fiber optic') factorsHtml += createFactor('網路 (光纖)', '增加風險', true);
        if (data.tenure < 12) factorsHtml += createFactor(`在網月數 (${data.tenure}月)`, '新戶風險', true);
    }

    factorsHtml += createFactor('AI 模型綜合評分', '計算完成', null);
    factorsList.innerHTML = factorsHtml;
}

function createFactor(name, impact, isBad) {
    let icon, style;
    if (isBad === true) {
        icon = '<i class="fa-solid fa-arrow-trend-up"></i>';
        style = 'color: #ef4444;';
    } else if (isBad === false) {
        icon = '<i class="fa-solid fa-arrow-trend-down"></i>';
        style = 'color: #10b981;';
    } else {
        icon = '';
        style = 'color: #94a3b8;';
    }

    return `<li class="factor-item">
                <span class="factor-name">${name}</span> 
                <span class="factor-impact" style="${style}">${icon} ${impact}</span>
            </li>`;
}

function updateChart(probability, isHighRisk) {
    const ctx = document.getElementById('churnChart').getContext('2d');
    const remain = 1 - probability;

    if (churnChartInstance) {
        churnChartInstance.destroy();
    }

    const activeColor = isHighRisk ? '#ef4444' : '#10b981'; 

    churnChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['流失機率', '留存機率'],
            datasets: [{
                data: [probability, remain],
                backgroundColor: [activeColor, '#334155'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: { legend: { display: false } }
        }
    });
}




