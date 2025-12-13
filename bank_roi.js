// bank_roi.js

// 在檔案最上方定義一個變數來儲存所有資料
let fullRoiDataList = [];


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
    
    // 將後端回傳的完整資料存入全域變數
    fullRoiDataList = data.results || [];

    // 1. 更新 KPI 卡片 (保持不變)
    const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    
    document.getElementById('kpiCount').innerText = summary.actionable_count.toLocaleString();
    document.getElementById('kpiRoi').innerText = currencyFmt.format(summary.total_roi);
    document.getElementById('kpiCost').innerText = currencyFmt.format(summary.total_cost);
    
    const avgEnr = summary.actionable_count > 0 ? (summary.total_roi / summary.actionable_count) : 0;
    document.getElementById('kpiAvgEnr').innerText = currencyFmt.format(avgEnr);

    // 2. 顯示表格 (預設顯示全部或前 500 筆)
    filterRoiTable();

    // 顯示區塊
    section.style.display = 'block';
}

/**
 * 搜尋過濾功能
 * 根據輸入框的內容篩選 fullRoiDataList，然後重新繪製表格
 */
function filterRoiTable() {
    const input = document.getElementById('tableSearchInput');
    const filter = input.value.toLowerCase().trim();
    
    // 如果沒有輸入內容，就顯示原始清單
    let filteredData = fullRoiDataList;

    if (filter) {
        filteredData = fullRoiDataList.filter(item => {
            const idStr = String(item.customerId).toLowerCase();
            const surnameStr = String(item.surname).toLowerCase();
            // 只要 ID 或 姓氏 包含關鍵字就符合
            return idStr.includes(filter) || surnameStr.includes(filter);
        });
    }

    displayTableRows(filteredData);
}

/**
 * 負責將資料渲染到 HTML Table
 */
function displayTableRows(dataList) {
    const tbody = document.getElementById('roiTableBody');
    const statsLabel = document.getElementById('roiListStats');
    const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    
    tbody.innerHTML = ''; // 清空舊資料

    // 更新筆數顯示
    statsLabel.innerText = `(顯示 ${dataList.length} 筆 / 共 ${fullRoiDataList.length} 筆)`;

    if (dataList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:20px;">找不到符合的資料。</td></tr>';
        return;
    }

    // 如果您想顯示全部資料，請直接將 dataList 賦值給 dataToRender
    const dataToRender = dataList; 

    // 如果想限制顯示筆數（例如 500 筆），則使用下面這行（二擇一）：
    // const displayLimit = 500;
    // const dataToRender = dataList.slice(0, displayLimit);

    dataToRender.forEach((item, index) => {
        const tr = document.createElement('tr');
        
        // 格式化數字
        const probPercent = (item.probability * 100).toFixed(1) + '%';
        const ltvStr = currencyFmt.format(item.ltv);
        const enrStr = currencyFmt.format(item.enr);

        // 高亮 ENR 特別高的 (前 3 名) - 注意這裡是用原始排序的 index
        const originalIndex = fullRoiDataList.indexOf(item);
        const enrStyle = originalIndex < 3 ? 'color: #fbbf24; font-weight: bold;' : 'color: #38bdf8;';

        tr.innerHTML = `
            <td style="padding: 12px; color: #94a3b8;">#${originalIndex + 1}</td>
            <td style="padding: 12px;">${item.customerId}</td>
            <td style="padding: 12px;">${item.surname}</td>
            <td style="padding: 12px;">${probPercent}</td>
            <td style="padding: 12px;">${ltvStr}</td>
            <td style="padding: 12px; ${enrStyle}">${enrStr}</td>
        `;
        tbody.appendChild(tr);
    });

    // 如果資料被截斷，顯示提示
    /*if (dataList.length > displayLimit) {
        const tr = document.createElement('tr');
        tr.innerHTML = `<td colspan="6" style="text-align:center; color: #64748b; font-size: 12px; padding: 10px;">
            還有 ${dataList.length - displayLimit} 筆資料未顯示，請使用搜尋功能查看特定客戶。
        </td>`;
        tbody.appendChild(tr);
    }*/
}