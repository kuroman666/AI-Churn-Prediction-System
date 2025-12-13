// bank_prediction.js - 整合單筆預測與批次分析

// --- 全域變數設定 ---
let churnChartInstance = null;
let shapChartInstance = null;
let globalBatchData = []; // 儲存批次分析的原始資料

// 自動判斷後端 API 網址
const API_BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
    ? 'http://127.0.0.1:5000' 
    : 'https://ai-churn-prediction-system.onrender.com';

// ==========================================
// PART 1: 單筆預測功能 (原 bank.js)
// ==========================================

async function predictChurn() {
    const btn = document.querySelector('#predictionForm .btn-predict'); // 鎖定表單內的按鈕
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
    // 讓畫面平滑捲動到結果區
    resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

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

// ==========================================
// PART 2: 批次分析功能 (原 bank_data.js)
// ==========================================

async function uploadAndPredict() {
    const fileInput = document.getElementById('csvFileInput');
    // 鎖定上傳區塊的按鈕，避免選到單筆預測的按鈕
    const btn = fileInput.parentNode.querySelector('.btn-predict');
    
    if (fileInput.files.length === 0) {
        alert("請先選擇一個 CSV 檔案！");
        return;
    }

    const file = fileInput.files[0];
    const formData = new FormData();
    formData.append('file', file);

    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 處理中...';
    btn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/predict_batch`, {
            method: 'POST',
            body: formData 
        });

        const result = await response.json();

        if (response.ok) {
            renderBatchResults(result.results);
        } else {
            alert('分析失敗：' + (result.error || '未知錯誤'));
        }

    } catch (error) {
        alert('無法連接到後端伺服器');
        console.error(error);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function renderBatchResults(data) {
    globalBatchData = data;
    console.log("回傳資料筆數:", data.length);

    const section = document.getElementById('batchResultSection');
    section.style.display = 'block';
    
    // 平滑捲動到批次結果區
    setTimeout(() => {
        section.classList.add('active'); 
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 10);

    filterData();
}

function filterData() {
    const thresholdInput = document.getElementById('thresholdInput');
    const searchInput = document.getElementById('searchInput');
    const tbody = document.getElementById('batchResultBody');
    const statsDiv = document.getElementById('filterStats');

    let thresholdPercent = parseFloat(thresholdInput.value);
    if (isNaN(thresholdPercent)) thresholdPercent = 0;
    const thresholdDecimal = thresholdPercent / 100;

    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

    const filteredData = globalBatchData.filter(row => {
        const passThreshold = row.probability >= thresholdDecimal;
        const customerIdStr = String(row.customerId).toLowerCase();
        const surnameStr = String(row.surname).toLowerCase();
        
        const passSearch = searchTerm === '' || 
                           customerIdStr.includes(searchTerm) || 
                           surnameStr.includes(searchTerm);

        return passThreshold && passSearch;
    });

    filteredData.sort((a, b) => b.probability - a.probability);

    tbody.innerHTML = ''; 

    statsDiv.innerHTML = `
        篩選條件 > ${thresholdPercent}% ${searchTerm ? ` + "${searchTerm}"` : ''} : 
        共有 <span class="highlight">${filteredData.length}</span> 位符合
        (總數: ${globalBatchData.length})
    `;

    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color: #94a3b8;">沒有符合條件的客戶</td></tr>';
        return;
    }

    filteredData.forEach(row => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #1e293b';
        
        const probPercent = (row.probability * 100).toFixed(1) + '%';
        const isHighRisk = row.probability > 0.5;
        
        const riskColor = isHighRisk ? '#ef4444' : '#10b981';
        const riskLabel = isHighRisk ? '高風險' : '低風險';

        const features = row.important_features || []; 
        const f1 = features.length > 0 ? features[0] : '-';
        const f2 = features.length > 1 ? features[1] : '-';
        const f3 = features.length > 2 ? features[2] : '-';

        tr.innerHTML = `
            <td style="padding: 12px;">${row.customerId}</td>
            <td style="padding: 12px;">${row.surname}</td>
            <td style="padding: 12px; font-weight: bold; color: ${riskColor};">${probPercent}</td>
            <td style="padding: 12px;">
                <span style="background-color: ${riskColor}20; color: ${riskColor}; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                    ${riskLabel}
                </span>
            </td>
            <td style="padding: 12px; color: #94a3b8; font-size: 14px;">${f1}</td>
            <td style="padding: 12px; color: #94a3b8; font-size: 14px;">${f2}</td>
            <td style="padding: 12px; color: #94a3b8; font-size: 14px;">${f3}</td>
        `;
        tbody.appendChild(tr);
    });
}