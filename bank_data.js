// bank_data.js - 處理批次 CSV 分析

// 自動判斷後端 API 網址
const API_BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
    ? 'http://127.0.0.1:5000' 
    : 'https://ai-churn-prediction-system.onrender.com';

async function uploadAndPredict() {
    const fileInput = document.getElementById('csvFileInput');
    const btn = document.querySelector('.btn-predict');
    
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
        // 使用 API_BASE_URL 自動切換
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
    const section = document.getElementById('batchResultSection');
    const tbody = document.getElementById('batchResultBody');
    
    section.style.display = 'block';
    tbody.innerHTML = ''; 

    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.style.borderBottom = '1px solid #1e293b';
        
        const probPercent = (row.probability * 100).toFixed(1) + '%';
        const isHighRisk = row.probability > 0.5;
        
        const riskColor = isHighRisk ? '#ef4444' : '#10b981';
        const riskLabel = isHighRisk ? '高風險' : '低風險';

        tr.innerHTML = `
            <td style="padding: 12px;">${row.customerId}</td>
            <td style="padding: 12px;">${row.surname}</td>
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