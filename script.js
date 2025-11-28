// 初始化 Chart.js 圖表實例
let churnChartInstance = null;

/**
 * ==========================================
 * 功能 1: 銀行客戶流失預測 (Bank Churn)
 * ==========================================
 */
function predictChurn() {
    // 1. 獲取表單數據
    const formData = {
        creditScore: parseInt(document.getElementById('creditScore').value),
        geography: document.getElementById('geography').value,
        gender: document.getElementById('gender').value,
        age: parseInt(document.getElementById('age').value),
        balance: parseFloat(document.getElementById('balance').value),
        active: document.getElementById('isActiveMember').checked
    };

    // 2. 模擬後端 AI 模型邏輯
    let mockProbability = 0.2; 

    if (formData.geography === 'Germany') mockProbability += 0.15;
    if (formData.age > 50) mockProbability += 0.2;
    else if (formData.age > 40) mockProbability += 0.1;
    if (!formData.active) mockProbability += 0.15;
    if (formData.balance > 100000) mockProbability += 0.1;
    
    mockProbability += (Math.random() * 0.1 - 0.05); 
    mockProbability = Math.min(Math.max(mockProbability, 0.05), 0.98);

    // 3. 更新 UI
    updateUI(mockProbability, 'bank', formData);
}

/**
 * ==========================================
 * 功能 2: 電信客戶流失預測 (Telecom Churn)
 * ==========================================
 */
function predictTelecomChurn() {
    // 1. 獲取表單數據 (19個欄位)
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

    // 2. 模擬電信 AI 模型邏輯 (Mock Logic)
    let mockProbability = 0.3; // 基礎機率

    // 電信流失常見特徵：按月付費、光纖、高月費、資歷淺
    if (formData.contract === 'Month-to-month') mockProbability += 0.25; // 按月簽約風險高
    if (formData.contract === 'Two year') mockProbability -= 0.2;     // 兩年合約風險低
    
    if (formData.internetService === 'Fiber optic') mockProbability += 0.15; // 光纖通常較貴，流失率較高
    
    if (formData.tenure < 12) mockProbability += 0.15; // 新用戶風險高
    if (formData.tenure > 60) mockProbability -= 0.15; // 老用戶相對忠誠

    if (formData.monthlyCharges > 100) mockProbability += 0.1; // 高資費
    if (formData.techSupport === 'No') mockProbability += 0.05; // 沒技術支援較易不滿

    // 隨機擾動
    mockProbability += (Math.random() * 0.1 - 0.05);
    mockProbability = Math.min(Math.max(mockProbability, 0.05), 0.98);

    // 3. 更新 UI
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

    // 判斷風險高低
    let isHighRisk = probability > 0.5;
    
    // 設定顏色 (銀行用紅色，電信用紫色)
    let highColor1, highColor2;
    if (type === 'bank') {
        highColor1 = '#f87171'; highColor2 = '#ef4444'; // 紅
    } else {
        highColor1 = '#a855f7'; highColor2 = '#d946ef'; // 紫/粉
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

    // 更新圖表
    updateChart(probability, isHighRisk);

    // 生成建議與關鍵因子 (根據不同產業)
    let factorsHtml = '';
    
    if (type === 'bank') {
        // --- 銀行版建議 ---
        if (isHighRisk) suggestionText.innerText = "客戶流失風險極高！建議立即指派專員聯繫，並提供「高資產客戶專屬優惠」或「手續費減免」方案。";
        else suggestionText.innerText = "客戶狀態穩定。建議維持定期電子報互動，並推薦適合的理財產品。";

        // 銀行因子
        if (data.geography === 'Germany') factorsHtml += createFactor('地理位置 (Germany)', '增加風險', true);
        if (data.age > 45) factorsHtml += createFactor(`年齡 (${data.age})`, '增加風險', true);
        if (!data.active) factorsHtml += createFactor('活躍狀態 (Inactive)', '增加風險', true);
        else factorsHtml += createFactor('活躍狀態 (Active)', '降低風險', false);

    } else {
        // --- 電信版建議 ---
        if (isHighRisk) suggestionText.innerText = "偵測到高流失風險！該用戶可能因「按月合約」或「高資費」考慮轉網。建議提供：綁約折扣、升級光纖優惠或贈送串流服務 (Netflix/Disney+)。";
        else suggestionText.innerText = "用戶忠誠度高 (長約/資深用戶)。建議推薦家庭方案 (Family Plan) 或升級 5G 服務以提升 ARPU。";

        // 電信因子
        if (data.contract === 'Month-to-month') factorsHtml += createFactor('合約 (按月付費)', '增加風險 (高)', true);
        else if (data.contract === 'Two year') factorsHtml += createFactor('合約 (兩年)', '降低風險', false);
        
        if (data.internetService === 'Fiber optic') factorsHtml += createFactor('網路 (光纖)', '增加風險', true);
        
        if (data.tenure < 12) factorsHtml += createFactor(`在網月數 (${data.tenure}月)`, '新戶風險', true);
        else if (data.tenure > 48) factorsHtml += createFactor(`在網月數 (${data.tenure}月)`, '忠誠用戶', false);

        if (data.monthlyCharges > 90) factorsHtml += createFactor('月費偏高', '增加風險', true);
    }

    // 補一個通用因子
    factorsHtml += createFactor('其他特徵綜合評估', '影響輕微', null);
    factorsList.innerHTML = factorsHtml;
}

// 輔助函數：產生因子 HTML
function createFactor(name, impact, isBad) {
    let icon, colorClass;
    if (isBad === true) {
        icon = '<i class="fa-solid fa-arrow-trend-up"></i>';
        colorClass = 'text-danger'; // 紅色 (style.css 定義或直接用 style)
        style = 'color: #ef4444;';
    } else if (isBad === false) {
        icon = '<i class="fa-solid fa-arrow-trend-down"></i>';
        colorClass = 'text-success';
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

/**
 * 繪製圖表
 */
function updateChart(probability, isHighRisk) {
    const ctx = document.getElementById('churnChart').getContext('2d');
    const remain = 1 - probability;

    if (churnChartInstance) {
        churnChartInstance.destroy();
    }

    // 顏色設定
    const activeColor = isHighRisk ? '#ef4444' : '#10b981'; // 紅 或 綠
    // 如果是電信頁面且高風險，也可以考慮改成紫色系，這裡簡單用紅綠區分風險

    churnChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['流失機率', '留存機率'],
            datasets: [{
                data: [probability, remain],
                backgroundColor: [
                    activeColor,
                    '#334155' // 深灰底色
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: { display: false }
            }
        }
    });
}




