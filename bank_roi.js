// bank_roi.js

const API_BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
    ? 'http://127.0.0.1:5000' 
    : 'https://ai-churn-prediction-system.onrender.com';

async function calculateROI() {
    const fileInput = document.getElementById('roiCsvInput');
    const costInput = document.getElementById('retentionCost');
    const rateInput = document.getElementById('successRate');
    const btn = document.querySelector('.btn-predict');

    if (fileInput.files.length === 0) {
        alert("請先選擇 CSV 檔案！");
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('cost', costInput.value);
    formData.append('rate', rateInput.value);

    // UI Loading 狀態
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 計算模型中...';
    btn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/predict_roi`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (response.ok) {
            renderRoiResults(result);
        } else {
            alert('分析失敗：' + (result.error || '未知錯誤'));
        }

    } catch (error) {
        console.error(error);
        alert('無法連接後端伺服器');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function renderRoiResults(data) {
    const section = document.getElementById('roiResultSection');
    const summary = data.summary;
    const list = data.results;

    // 1. 更新 KPI 卡片
    // 使用 Intl.NumberFormat 格式化金額
    const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    
    document.getElementById('kpiCount').innerText = summary.actionable_count.toLocaleString();
    document.getElementById('kpiRoi').innerText = currencyFmt.format(summary.total_roi);
    document.getElementById('kpiCost').innerText = currencyFmt.format(summary.total_cost);
    
    const avgEnr = summary.actionable_count > 0 ? (summary.total_roi / summary.actionable_count) : 0;
    document.getElementById('kpiAvgEnr').innerText = currencyFmt.format(avgEnr);

    // 2. 更新表格
    const tbody = document.getElementById('roiTableBody');
    tbody.innerHTML = '';

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">沒有任何客戶符合正回報 (ROI > 0) 條件。</td></tr>';
    } else {
        // 只顯示前 100 筆，避免網頁卡頓
        const displayLimit = 100;
        list.slice(0, displayLimit).forEach((item, index) => {
            const tr = document.createElement('tr');
            
            // 格式化數字
            const probPercent = (item.probability * 100).toFixed(1) + '%';
            const ltvStr = currencyFmt.format(item.ltv);
            const enrStr = currencyFmt.format(item.enr);

            // 高亮 ENR 特別高的
            const enrStyle = index < 3 ? 'color: #fbbf24; font-weight: bold;' : 'color: #38bdf8;';

            tr.innerHTML = `
                <td style="padding: 12px; color: #94a3b8;">#${index + 1}</td>
                <td style="padding: 12px;">${item.customerId}</td>
                <td style="padding: 12px;">${item.surname}</td>
                <td style="padding: 12px;">${probPercent}</td>
                <td style="padding: 12px;">${ltvStr}</td>
                <td style="padding: 12px; ${enrStyle}">${enrStr}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    // 顯示區塊
    section.style.display = 'block';
    
    // 更新統計文字
    document.getElementById('roiListStats').innerHTML = `
        顯示 ROI 最高的 ${Math.min(list.length, 100)} 筆資料 (共 ${list.length} 筆)
    `;
}