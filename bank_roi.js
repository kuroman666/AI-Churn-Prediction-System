// bank_roi.js

// 全域變數
let fullRoiDataList = [];

// 自動判斷 API 網址
const API_BASE_URL = (window.location.hostname === '127.0.0.1' || window.location.hostname === 'localhost')
    ? 'http://127.0.0.1:5000' 
    : 'https://ai-churn-prediction-system.onrender.com';

// ==========================================
// PART 1: 單筆即時 ROI 計算
// ==========================================
async function calculateSingleROI() {
    const btn = document.querySelector('.btn-single');
    const originalText = btn.innerHTML;
    
    // ★★★ 修改：直接從單筆表單中取得成本與成功率 ★★★
    const cost = parseFloat(document.getElementById('s_cost').value) || 500;
    const rate = parseFloat(document.getElementById('s_rate').value) || 0.2;

    // 2. 取得表單輸入 (移除 ID 與 Surname 的讀取)
    const formData = {
        creditScore: document.getElementById('s_creditScore').value,
        geography: document.getElementById('s_geography').value,
        gender: document.getElementById('s_gender').value,
        age: document.getElementById('s_age').value,
        tenure: document.getElementById('s_tenure').value,
        balance: document.getElementById('s_balance').value,
        numOfProducts: document.getElementById('s_numOfProducts').value,
        hasCrCard: document.getElementById('s_hasCrCard').checked,
        salary: document.getElementById('s_salary').value,
        active: document.getElementById('s_isActiveMember').checked
    };

    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 計算中...';
    btn.disabled = true;

    try {
        const response = await fetch(`${API_BASE_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(formData)
        });

        const result = await response.json();

        if (response.ok) {
            // 前端計算 LTV / ENR
            const NIM_RATE = 0.02;
            const PRODUCT_PROFIT = 50.0;
            const ACTIVE_CARD_PROFIT = 30.0;
            const L_MAX = 10.0;

            const balance = parseFloat(formData.balance);
            const numProducts = parseInt(formData.numOfProducts);
            const activeCardVal = (formData.hasCrCard && formData.active) ? 1 : 0;
            
            const annualProfit = (balance * NIM_RATE) + (numProducts * PRODUCT_PROFIT) + (activeCardVal * ACTIVE_CARD_PROFIT);
            
            const prob = result.probability;
            const expectedLifespan = Math.min(1 / Math.max(prob, 0.000001), L_MAX);

            const ltv = annualProfit * expectedLifespan;
            const enr = (ltv * prob * rate) - cost;

            updateSingleResultUI(result.probability, ltv, enr);

        } else {
            alert('預測失敗：' + (result.error || '未知錯誤'));
        }

    } catch (error) {
        console.error(error);
        alert('無法連接後端伺服器');
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function updateSingleResultUI(prob, ltv, enr) {
    document.getElementById('singleResultEmpty').style.display = 'none';
    document.getElementById('singleResultData').style.display = 'block';

    // ★★★ 修改：移除 ID 與 Surname 的顯示邏輯 ★★★
    // document.getElementById('res_id').innerText = ... (已刪除)
    // document.getElementById('res_surname').innerText = ... (已刪除)

    const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    const probPercent = (prob * 100).toFixed(1);

    document.getElementById('res_prob').innerText = `${probPercent}%`;
    document.getElementById('res_ltv').innerText = currencyFmt.format(ltv);
    
    const enrEl = document.getElementById('res_enr');
    enrEl.innerText = currencyFmt.format(enr);

    document.getElementById('res_prob_bar').style.width = `${probPercent}%`;

    const recBox = document.getElementById('res_recommendation');
    
    if (enr > 0) {
        enrEl.className = 'm-value text-green';
        enrEl.innerText = `+ ${currencyFmt.format(enr)}`;
        recBox.style.background = 'rgba(16, 185, 129, 0.1)';
        recBox.style.borderColor = 'rgba(16, 185, 129, 0.3)';
        recBox.innerHTML = `<i class="fa-solid fa-check-circle" style="color:#10b981;"></i> <b>建議挽留</b><br>預期淨利為正，具備投資價值。`;
    } else {
        enrEl.className = 'm-value text-red';
        recBox.style.background = 'rgba(239, 68, 68, 0.1)';
        recBox.style.borderColor = 'rgba(239, 68, 68, 0.3)';
        recBox.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="color:#ef4444;"></i> <b>不建議挽留</b><br>預期淨利為負，成本高於回收價值。`;
    }
}

// ==========================================
// PART 2: 批次 CSV 分析
// ==========================================
async function calculateROI() {
    const fileInput = document.getElementById('roiCsvInput');
    const costInput = document.getElementById('retentionCost');
    const rateInput = document.getElementById('successRate');
    const btn = document.querySelector('.btn-batch');

    if (fileInput.files.length === 0) {
        alert("請先選擇 CSV 檔案！");
        return;
    }

    const formData = new FormData();
    formData.append('file', fileInput.files[0]);
    formData.append('cost', costInput.value);
    formData.append('rate', rateInput.value);

    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> 計算中...';
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
    fullRoiDataList = data.results || [];

    const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
    
    document.getElementById('kpiCount').innerText = summary.actionable_count.toLocaleString();
    document.getElementById('kpiRoi').innerText = currencyFmt.format(summary.total_roi);
    document.getElementById('kpiCost').innerText = currencyFmt.format(summary.total_cost);
    
    const avgEnr = summary.actionable_count > 0 ? (summary.total_roi / summary.actionable_count) : 0;
    document.getElementById('kpiAvgEnr').innerText = currencyFmt.format(avgEnr);

    filterRoiTable();
    section.style.display = 'block';
    
    // 平滑捲動
    setTimeout(() => {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
}

function filterRoiTable() {
    const input = document.getElementById('tableSearchInput');
    const filter = input.value.toLowerCase().trim();
    const tbody = document.getElementById('roiTableBody');
    const statsLabel = document.getElementById('roiListStats');
    const currencyFmt = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

    let filteredData = fullRoiDataList;
    if (filter) {
        filteredData = fullRoiDataList.filter(item => {
            return String(item.customerId).toLowerCase().includes(filter) || 
                   String(item.surname).toLowerCase().includes(filter);
        });
    }

    tbody.innerHTML = '';
    statsLabel.innerText = `(顯示 ${filteredData.length} 筆)`;

    if (filteredData.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding:20px; color:#64748b;">無符合資料</td></tr>';
        return;
    }

    filteredData.forEach((item, index) => {
        const tr = document.createElement('tr');
        const probPercent = (item.probability * 100).toFixed(1) + '%';
        
        // 前三名高亮
        const rank = fullRoiDataList.indexOf(item) + 1;
        let enrStyle = '';
        if (rank <= 3) enrStyle = 'color: #fbbf24; font-weight: bold;';
        else if (item.enr > 0) enrStyle = 'color: #38bdf8;';
        else enrStyle = 'color: #ef4444;';

        tr.innerHTML = `
            <td>#${rank}</td>
            <td>${item.customerId}</td>
            <td>${item.surname}</td>
            <td>${probPercent}</td>
            <td>${currencyFmt.format(item.ltv)}</td>
            <td style="${enrStyle}">${currencyFmt.format(item.enr)}</td>
        `;
        tbody.appendChild(tr);
    });
}