// bank_data.js - 處理批次 CSV 分析

// 自動判斷後端 API 網址
const API_BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
    ? 'http://127.0.0.1:5000' 
    : 'https://ai-churn-prediction-system.onrender.com';

// ★★★ 新增：全域變數用來儲存原始資料 ★★★
let globalBatchData = [];

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
    // 1. 先將後端回傳的原始資料存起來
    globalBatchData = data;
    
    console.log("回傳資料筆數:", data.length);

    const section = document.getElementById('batchResultSection');
    
    // 顯示區塊
    section.style.display = 'block';
    setTimeout(() => {
        section.classList.add('active'); 
    }, 10);

    // ★★★ 2. 呼叫篩選函式來渲染表格 (預設使用輸入框的值) ★★★
    filterData();
}

// bank_data.js 中的 filterData 函式

// bank_data.js

function filterData() {
    const thresholdInput = document.getElementById('thresholdInput');
    const searchInput = document.getElementById('searchInput'); // ★★★ 取得搜尋框
    const tbody = document.getElementById('batchResultBody');
    const statsDiv = document.getElementById('filterStats');

    // 1. 取得機率門檻
    let thresholdPercent = parseFloat(thresholdInput.value);
    if (isNaN(thresholdPercent)) thresholdPercent = 0;
    const thresholdDecimal = thresholdPercent / 100;

    // ★★★ 2. 取得搜尋關鍵字 (轉小寫以忽略大小寫差異) ★★★
    const searchTerm = searchInput ? searchInput.value.trim().toLowerCase() : '';

    // 3. 綜合篩選邏輯 (機率 AND (ID吻合 OR 姓氏吻合))
    const filteredData = globalBatchData.filter(row => {
        // 機率條件
        const passThreshold = row.probability >= thresholdDecimal;
        
        // ★★★ 搜尋條件 ★★★
        // 確保轉為字串再比對，避免 ID 是數字導致錯誤
        const customerIdStr = String(row.customerId).toLowerCase();
        const surnameStr = String(row.surname).toLowerCase();
        
        // 如果搜尋框是空的，視為通過；否則檢查是否包含關鍵字
        const passSearch = searchTerm === '' || 
                           customerIdStr.includes(searchTerm) || 
                           surnameStr.includes(searchTerm);

        return passThreshold && passSearch;
    });

    // 4. 排序 (由大到小)
    filteredData.sort((a, b) => b.probability - a.probability);

    // 清空表格
    tbody.innerHTML = ''; 

    // 更新統計文字
    statsDiv.innerHTML = `
        篩選條件 > ${thresholdPercent}% ${searchTerm ? ` + "${searchTerm}"` : ''} : 
        共有 <span class="highlight">${filteredData.length}</span> 位符合
        (總數: ${globalBatchData.length})
    `;

    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center; padding:20px; color: #94a3b8;">沒有符合條件的客戶</td></tr>';
        return;
    }

    // 5. 渲染資料
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

        // ★★★ 如果有搜尋關鍵字，可以選用將關鍵字高亮 (這裡保持簡單，不影響渲染)
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