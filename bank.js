// bank.js - 處理單筆預測與圖表

let churnChartInstance = null;
let shapChartInstance = null;

// 自動判斷後端 API 網址 (解決 404 問題)
const API_BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
    ? 'http://127.0.0.1:5000' 
    : 'https://ai-churn-prediction-system.onrender.com';

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
        const response = await fetch(`${API_BASE_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (response.ok) {
            updateUI(result.probability, result.shap_data, formData);
        } else {
            alert('預測失敗：' + (result.error || '未知錯誤'));
        }

    } catch (error) {
        alert('無法連接到後端伺服器，請確認 app.py 是否已啟動。');
        console.error('Connection error:', error);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function updateUI(probability, shapData, inputData) {
    const resultSection = document.getElementById('resultSection');
    const probValue = document.getElementById('probValue');
    const riskBadge = document.getElementById('riskBadge');
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
        suggestionText.innerText = "客戶流失風險極高！主因可能是" + getTopReason(shapData) + "。建議立即聯繫。";
    } else {
        riskBadge.className = 'risk-badge risk-low';
        riskBadge.innerText = '低風險 Low Risk';
        probValue.style.background = 'linear-gradient(90deg, #34d399, #10b981)';
        probValue.style.webkitBackgroundClip = 'text';
        suggestionText.innerText = "客戶狀態穩定。主要正面因素為" + getTopReason(shapData, false) + "。";
    }

    updateChart(probability, isHighRisk);
    updateShapChart(shapData); 
}

function getTopReason(shapData, findRisk=true) {
    if(!shapData) return "未知因素";
    const sorted = [...shapData].sort((a, b) => findRisk ? b.impact - a.impact : a.impact - b.impact);
    return sorted[0].feature;
}

function updateChart(probability, isHighRisk) {
    const ctx = document.getElementById('churnChart').getContext('2d');
    const activeColor = isHighRisk ? '#ef4444' : '#10b981'; 

    if (churnChartInstance) churnChartInstance.destroy();

    churnChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['流失機率', '留存機率'],
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

function updateShapChart(shapData) {
    const ctx = document.getElementById('shapChart').getContext('2d');

    if (shapChartInstance) shapChartInstance.destroy();

    const labels = shapData.map(item => item.feature);
    const dataValues = shapData.map(item => item.impact);
    const backgroundColors = dataValues.map(val => val > 0 ? '#ef4444' : '#10b981');

    shapChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'SHAP Value (影響力)',
                data: dataValues,
                backgroundColor: backgroundColors,
                borderRadius: 4,
                borderSkipped: false
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { color: '#334155' },
                    ticks: { color: '#94a3b8' },
                    title: { display: true, text: '影響力 (右: 增加風險 / 左: 降低風險)', color: '#94a3b8' }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#e2e8f0', font: { size: 11 } }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) label += ': ';
                            let val = context.parsed.x;
                            label += val.toFixed(4);
                            return label;
                        },
                        afterLabel: function(context) {
                            const dataIndex = context.dataIndex;
                            return '實際數值: ' + shapData[dataIndex].value;
                        }
                    }
                }
            }
        }
    });
}