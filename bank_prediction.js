// bank_prediction.js - 整合單筆預測與批次分析

// --- 全域變數設定 ---
let churnChartInstance = null;
let shapChartInstance = null;
let globalBatchData = [];
// ★ 新增：批次專用的 Chart 實例，避免跟上方的衝突
let batchChurnChartInstance = null;
let batchShapChartInstance = null;

// 自動判斷後端 API 網址
const API_BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
    ? 'http://127.0.0.1:5000' 
    : 'https://ai-churn-prediction-system.onrender.com';

// ==========================================
// PART 1: 單筆預測功能
// ==========================================

async function predictChurn() {
    const btn = document.querySelector('#predictionForm .btn-predict');
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
    const placeholder = document.getElementById('predictionPlaceholder'); // 新增這行

    // --- 新增：切換顯示狀態 ---
    if (placeholder) {
        placeholder.style.display = 'none'; // 隱藏提示卡片
    }
    resultSection.style.display = 'grid'; // 顯示結果區
    
    const probValue = document.getElementById('probValue');
    const riskBadge = document.getElementById('riskBadge');
    const suggestionText = document.getElementById('suggestionText');

    // ★★★ 修改重點：將 'flex' 改為 'grid' (或者 'block' 亦可，若 CSS 已設定 grid) ★★★
    // 舊的寫法: resultSection.style.display = 'flex'; 
    // 新的寫法:
    resultSection.style.display = 'grid';
    
    // 讓畫面平滑捲動到結果區 (雖然結果在右側，但手機版可能需要)
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
// PART 2: 批次分析功能
// ==========================================
// 新增功能: 點擊 ID 查看詳情
// 修改後的 viewCustomerDetail: 點擊時才去後端算 SHAP
// 修改後的 viewCustomerDetail: 將結果顯示在右側面板，而非捲動到上方
async function viewCustomerDetail(customerId) {
    // 1. 找到本地暫存的該筆資料
    const customerData = globalBatchData.find(row => row.customerId == customerId);
    
    if (!customerData) {
        alert("找不到該客戶資料");
        return;
    }

    // 2. 取得右側面板的 DOM 元素 (使用新 ID)
    const placeholder = document.getElementById('batchPlaceholder');
    const detailContent = document.getElementById('batchDetailContent');
    
    const probValue = document.getElementById('batch_probValue');
    const riskBadge = document.getElementById('batch_riskBadge');
    const suggestionText = document.getElementById('batch_suggestionText');
    const header = document.getElementById('batch_detailHeader');

    // UI 切換: 隱藏提示，顯示內容
    if (placeholder) placeholder.style.display = 'none';
    if (detailContent) detailContent.style.display = 'flex';

    // 3. 顯示「分析中」狀態
    probValue.innerText = "...";
    probValue.style.fontSize = "1.5rem";
    riskBadge.innerText = "計算中...";
    riskBadge.className = 'risk-badge';
    riskBadge.style.backgroundColor = '#64748b';
    suggestionText.innerText = "正在進行即時 SHAP 歸因分析...";
    header.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> 正在分析 ${customerData.surname}...`;

    // 4. 準備 API 資料
    const raw = customerData.raw_data;
    const apiPayload = {
        creditScore: raw.CreditScore,
        geography: raw.Geography,
        gender: raw.Gender,
        age: raw.Age,
        tenure: raw.Tenure,
        balance: raw.Balance,
        numOfProducts: raw.NumOfProducts,
        hasCrCard: raw.HasCrCard === 1,
        active: raw.IsActiveMember === 1,
        salary: raw.EstimatedSalary
    };

    try {
        // 呼叫預測 API
        const response = await fetch(`${API_BASE_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(apiPayload)
        });

        const result = await response.json();

        if (response.ok) {
            // 5. 更新右側 UI (呼叫專用的 Batch UI Update)
            header.innerHTML = `<i class="fa-solid fa-user-tag"></i> ${customerData.customerId} (${customerData.surname})`;
            probValue.style.fontSize = "2.5rem";
            
            updateBatchUI(result.probability, result.shap_data);
        } else {
            alert('分析失敗：' + (result.error || '未知錯誤'));
            riskBadge.innerText = "失敗";
        }

    } catch (error) {
        console.error('API Error:', error);
        alert('無法連接後端');
    }
}

// ★ 新增：專門處理批次右側面板的 UI 更新函式
function updateBatchUI(probability, shapData) {
    const probValue = document.getElementById('batch_probValue');
    const riskBadge = document.getElementById('batch_riskBadge');
    const suggestionText = document.getElementById('batch_suggestionText');

    const percentage = (probability * 100).toFixed(1);
    probValue.innerText = `${percentage}%`;

    const isHighRisk = probability > 0.5;

    if (isHighRisk) {
        riskBadge.className = 'risk-badge risk-high';
        riskBadge.innerText = '高風險 High Risk';
        probValue.style.background = `linear-gradient(90deg, #f87171, #ef4444)`;
        probValue.style.webkitBackgroundClip = 'text';
        suggestionText.innerText = "⚠️ 警告：此客戶流失風險高，主因為 " + getTopReason(shapData) + "。";
    } else {
        riskBadge.className = 'risk-badge risk-low';
        riskBadge.innerText = '低風險 Low Risk';
        probValue.style.background = 'linear-gradient(90deg, #34d399, #10b981)';
        probValue.style.webkitBackgroundClip = 'text';
        suggestionText.innerText = "✅ 狀態良好：客戶留存機率高，優勢在於 " + getTopReason(shapData, false) + "。";
    }

    // 更新右側圖表 (傳入專用的 ID)
    updateBatchCharts(probability, shapData, isHighRisk);
}

// ★ 新增：專門繪製批次右側圖表的函式
function updateBatchCharts(probability, shapData, isHighRisk) {
    // 1. 圓餅圖
    const ctxPie = document.getElementById('batch_churnChart').getContext('2d');
    const activeColor = isHighRisk ? '#ef4444' : '#10b981';

    if (batchChurnChartInstance) batchChurnChartInstance.destroy();

    batchChurnChartInstance = new Chart(ctxPie, {
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

    // 2. SHAP 長條圖
    const ctxBar = document.getElementById('batch_shapChart').getContext('2d');
    
    if (batchShapChartInstance) batchShapChartInstance.destroy();

    const labels = shapData.map(item => item.feature);
    const dataValues = shapData.map(item => item.impact);
    const bgColors = dataValues.map(val => val > 0 ? '#ef4444' : '#10b981');

    batchShapChartInstance = new Chart(ctxBar, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'SHAP Value',
                data: dataValues,
                backgroundColor: bgColors,
                borderRadius: 4
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    grid: { color: '#334155' },
                    ticks: { color: '#94a3b8' }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#e2e8f0', font: { size: 10 } } // 字體稍微縮小適應右側欄
                }
            },
            plugins: { legend: { display: false } }
        }
    });
}

async function uploadAndPredict() {
    const fileInput = document.getElementById('csvFileInput');
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
    
    setTimeout(() => {
        section.classList.add('active'); 
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 10);

    filterData();
}

function filterData() {
    // 1. 取得 DOM 元素
    const thresholdInput = document.getElementById('thresholdInput');
    const searchInput = document.getElementById('searchInput');
    const tbody = document.getElementById('batchResultBody');
    const statsDiv = document.getElementById('filterStats');

    // 2. 處理篩選數值
    let thresholdPercent = parseFloat(thresholdInput.value);
    if (isNaN(thresholdPercent)) thresholdPercent = 0;
    const thresholdDecimal = thresholdPercent / 100;

    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

    // 3. 執行篩選邏輯
    const filteredData = globalBatchData.filter(row => {
        const passThreshold = row.probability >= thresholdDecimal;
        const customerIdStr = String(row.customerId).toLowerCase();
        const surnameStr = String(row.surname).toLowerCase();
        
        const passSearch = searchTerm === '' || 
                           customerIdStr.includes(searchTerm) || 
                           surnameStr.includes(searchTerm);

        return passThreshold && passSearch;
    });

    // 4. 排序 (機率由高到低)
    filteredData.sort((a, b) => b.probability - a.probability);

    // 5. 清空表格與更新統計
    tbody.innerHTML = ''; 
    statsDiv.innerHTML = `
        篩選條件 > ${thresholdPercent}% ${searchTerm ? ` + "${searchTerm}"` : ''} : 
        共有 <span class="highlight">${filteredData.length}</span> 位符合
        (總數: ${globalBatchData.length})
    `;

    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px; color: #94a3b8;">沒有符合條件的客戶</td></tr>';
        return;
    }

    // 6. 迴圈開始
    filteredData.forEach(row => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #1e293b';
        
        let calcPercent = row.probability * 100;
        if (calcPercent > 99.9) calcPercent = 99.9;

        const probPercent = calcPercent.toFixed(1) + '%';
        const isHighRisk = row.probability > 0.5;
        
        const riskColor = isHighRisk ? '#ef4444' : '#10b981';
        const riskLabel = isHighRisk ? '高風險' : '低風險';

        // ★★★ 修正：這裡不再需要 f1, f2, f3 的定義，因為我們要把欄位刪掉了 ★★★

        tr.innerHTML = `
            <td class="clickable-id" onclick="viewCustomerDetail('${row.customerId}')" title="點擊查看詳細 SHAP 分析圖">
                <i class="fa-solid fa-chart-pie" style="margin-right:5px; font-size: 0.8em;"></i>
                ${row.customerId}
            </td>
            
            <td style="padding: 12px; text-align: left;">${row.surname}</td>
            
            <td style="padding: 12px; font-weight: bold; color: ${riskColor};">${probPercent}</td>
            <td style="padding: 12px;">
                <span style="background-color: ${riskColor}20; color: ${riskColor}; padding: 4px 8px; border-radius: 4px; font-size: 12px;">
                    ${riskLabel}
                </span>
            </td>
            
            `;
        
        tbody.appendChild(tr);
    });
}