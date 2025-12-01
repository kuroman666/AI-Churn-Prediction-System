// bank.js
let churnChartInstance = null;

async function predictChurn() {
    const btn = document.querySelector('.btn-predict');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 分析中...';
    btn.disabled = true;

    const formData = {
        creditScore: document.getElementById('creditScore').value,
        geography: document.getElementById('geography').value,
        gender: document.getElementById('gender').value,
        age: document.getElementById('age').value,
        tenure: document.getElementById('tenure').value,
        balance: document.getElementById('balance').value,
        numOfProducts: document.getElementById('numOfProducts').value,
        hasCrCard: document.getElementById('hasCrCard').checked,
        salary: document.getElementById('salary').value,
        active: document.getElementById('isActiveMember').checked
    };

    try {
        const response = await fetch('https://ai-churn-prediction-system.onrender.com/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (response.ok) {
            updateUI(result.probability, formData);
        } else {
            alert('預測失敗：' + (result.error || '未知錯誤'));
        }

    } catch (error) {
        alert('無法連接到後端伺服器。');
        console.error('Connection error:', error);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
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
        probValue.style.background = `linear-gradient(90deg, #f87171, #ef4444)`;
        probValue.style.webkitBackgroundClip = 'text';
        suggestionText.innerText = "客戶流失風險極高！建議立即指派專員聯繫。";
    } else {
        riskBadge.className = 'risk-badge risk-low';
        riskBadge.innerText = '低風險 Low Risk';
        probValue.style.background = 'linear-gradient(90deg, #34d399, #10b981)';
        probValue.style.webkitBackgroundClip = 'text';
        suggestionText.innerText = "客戶狀態穩定。建議維持定期互動。";
    }

    updateChart(probability, isHighRisk);

    // 銀行專屬因子判斷
    let factorsHtml = '';
    if (data.geography === 'Germany') factorsHtml += createFactor('地理位置 (Germany)', '增加風險', true);
    if (data.age > 45) factorsHtml += createFactor(`年齡 (${data.age})`, '增加風險', true);
    if (!data.active) factorsHtml += createFactor('活躍狀態 (Inactive)', '增加風險', true);
    else factorsHtml += createFactor('活躍狀態 (Active)', '降低風險', false);
    if (data.balance > 100000) factorsHtml += createFactor('資產餘額偏高', '流失可能性增加', true);
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