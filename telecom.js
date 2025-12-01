// telecom.js
let churnChartInstance = null;

function predictTelecomChurn() {
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

    // 模擬電信 AI 模型邏輯
    let mockProbability = 0.3; 
    if (formData.contract === 'Month-to-month') mockProbability += 0.25; 
    if (formData.contract === 'Two year') mockProbability -= 0.2;     
    if (formData.internetService === 'Fiber optic') mockProbability += 0.15; 
    if (formData.tenure < 12) mockProbability += 0.15; 
    if (formData.tenure > 60) mockProbability -= 0.15; 
    if (formData.monthlyCharges > 100) mockProbability += 0.1; 
    
    mockProbability += (Math.random() * 0.1 - 0.05);
    mockProbability = Math.min(Math.max(mockProbability, 0.05), 0.98);

    updateUI(mockProbability, formData);
}

function updateUI(probability, data) {
    const resultSection = document.getElementById('resultSection');
    const probValue = document.getElementById('probValue');
    const riskBadge = document.getElementById('riskBadge');
    const factorsList = document.getElementById('factorsList');
    const suggestionText = document.getElementById('suggestionText');

    resultSection.classList.add('active');

    const percentage = (probability * 100).toFixed(1);
    probValue.innerText = `${percentage}%`;

    const isHighRisk = probability > 0.5;

    if (isHighRisk) {
        riskBadge.className = 'risk-badge risk-high';
        riskBadge.innerText = '高風險 High Risk';
        probValue.style.background = `linear-gradient(90deg, #a855f7, #d946ef)`;
        probValue.style.webkitBackgroundClip = 'text';
        suggestionText.innerText = "高風險！建議提供綁約折扣。";
    } else {
        riskBadge.className = 'risk-badge risk-low';
        riskBadge.innerText = '低風險 Low Risk';
        probValue.style.background = 'linear-gradient(90deg, #34d399, #10b981)';
        probValue.style.webkitBackgroundClip = 'text';
        suggestionText.innerText = "忠誠用戶。建議推薦家庭方案。";
    }

    updateChart(probability, isHighRisk);

    // 電信專屬因子
    let factorsHtml = '';
    if (data.contract === 'Month-to-month') factorsHtml += createFactor('合約 (按月付費)', '增加風險', true);
    else if (data.contract === 'Two year') factorsHtml += createFactor('合約 (兩年)', '降低風險', false);
    if (data.internetService === 'Fiber optic') factorsHtml += createFactor('網路 (光纖)', '增加風險', true);
    if (data.tenure < 12) factorsHtml += createFactor(`在網月數 (${data.tenure}月)`, '新戶風險', true);
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
    return `<li class="factor-item"><span class="factor-name">${name}</span><span class="factor-impact" style="${style}">${icon} ${impact}</span></li>`;
}

function updateChart(probability, isHighRisk) {
    const ctx = document.getElementById('churnChart').getContext('2d');
    const activeColor = isHighRisk ? '#ef4444' : '#10b981'; 

    if (churnChartInstance) churnChartInstance.destroy();

    churnChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['流失', '留存'],
            datasets: [{
                data: [probability, 1 - probability],
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