/**
 * Billing Web App - SPA router and views
 */

const D = window.BillingData;

function $(sel, el = document) {
  return el.querySelector(sel);
}

function $$(sel, el = document) {
  return Array.from(el.querySelectorAll(sel));
}

function route() {
  const hash = (window.location.hash || '#dashboard').slice(1);
  const [view, id] = hash.split('/');
  const main = $('#main');
  if (!main) return;

  main.innerHTML = '';
  if (view === 'dashboard') renderDashboard(main);
  else if (view === 'invoices') renderInvoiceList(main);
  else if (view === 'invoice-new') renderInvoiceForm(main, null);
  else if (view === 'invoice-edit' && id) renderInvoiceForm(main, id);
  else if (view === 'customers') renderCustomers(main);
  else if (view === 'products') renderProducts(main);
  else if (view === 'reports') renderReports(main);
  else if (view === 'settings') renderSettings(main);
  else renderDashboard(main);
}

function setActiveNav(hash) {
  const base = hash.split('/')[0];
  const activeHash = base === 'invoice-edit' ? 'invoices' : base;
  $$('.nav-link').forEach((a) => {
    const href = (a.getAttribute('href') || '').slice(1).split('/')[0];
    a.classList.toggle('active', href === activeHash);
  });
}

function renderBusinessSwitcher() {
  const sel = document.getElementById('current-business-select');
  if (!sel) return;
  const currentId = D.getCurrentBusinessId();
  const businesses = D.getBusinesses();
  sel.innerHTML = businesses.map((b) => `<option value="${b.id}" ${b.id === currentId ? 'selected' : ''}>${b.name}</option>`).join('');
  sel.onchange = () => {
    D.setCurrentBusinessId(sel.value);
    route();
  };
}

// ---------- Dashboard ----------
function renderDashboard(container) {
  const currentId = D.getCurrentBusinessId();
  const invoices = D.getInvoices(currentId);
  const totalRevenue = invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0);
  const customers = D.getCustomers(currentId);
  const products = D.getProducts(currentId);
  container.innerHTML = `
    <div class="page-header">
      <h1>Dashboard</h1>
    </div>
    <div class="cards-row">
      <div class="card stat-card">
        <span class="stat-value">${invoices.length}</span>
        <span class="stat-label">Total Invoices</span>
      </div>
      <div class="card stat-card">
        <span class="stat-value">₹${totalRevenue.toLocaleString('en-IN')}</span>
        <span class="stat-label">Total Revenue</span>
      </div>
      <div class="card stat-card">
        <span class="stat-value">${customers.length}</span>
        <span class="stat-label">Customers</span>
      </div>
      <div class="card stat-card">
        <span class="stat-value">${products.length}</span>
        <span class="stat-label">Products</span>
      </div>
    </div>
    <div class="card">
      <h2>Recent Invoices</h2>
      ${invoices.length === 0 ? '<p class="muted">No invoices yet. <a href="#invoice-new">Create your first invoice</a></p>' : `
      <table class="table">
        <thead><tr><th>Invoice #</th><th>Customer</th><th>Date</th><th>Amount</th><th></th></tr></thead>
        <tbody>
          ${invoices.slice(0, 10).map((inv) => `
            <tr>
              <td>${inv.invoiceNumber}</td>
              <td>${inv.customerName || '-'}</td>
              <td>${inv.date || '-'}</td>
              <td>₹${(inv.grandTotal || 0).toLocaleString('en-IN')}</td>
              <td><a href="#invoice-edit/${inv.id}" class="btn-sm">View</a></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      `}
    </div>
  `;
}

// ---------- Invoice List ----------
function renderInvoiceList(container) {
  const currentId = D.getCurrentBusinessId();
  const invoices = D.getInvoices(currentId);
  container.innerHTML = `
    <div class="page-header flex-between">
      <h1>Invoices</h1>
      <a href="#invoice-new" class="btn btn-primary">+ New Invoice</a>
    </div>
    <div class="card">
      ${invoices.length === 0 ? '<p class="muted">No invoices. <a href="#invoice-new">Create one</a></p>' : `
      <table class="table">
        <thead><tr><th>Invoice #</th><th>Customer</th><th>Date</th><th>Total</th><th></th></tr></thead>
        <tbody>
          ${invoices.map((inv) => `
            <tr>
              <td>${inv.invoiceNumber}</td>
              <td>${inv.customerName || '-'}</td>
              <td>${inv.date || '-'}</td>
              <td>₹${(inv.grandTotal || 0).toLocaleString('en-IN')}</td>
              <td>
                <a href="#invoice-edit/${inv.id}" class="btn-sm">Edit</a>
                <button class="btn-sm btn-print" data-id="${inv.id}">Print</button>
                <button class="btn-sm btn-danger btn-del-inv" data-id="${inv.id}">Delete</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      `}
    </div>
  `;
  container.querySelectorAll('.btn-print').forEach((btn) => {
    btn.addEventListener('click', () => printInvoice(btn.dataset.id));
  });
  container.querySelectorAll('.btn-del-inv').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (confirm('Delete this invoice? This cannot be undone.')) {
        D.deleteInvoice(btn.dataset.id);
        route();
      }
    });
  });
}

// ---------- Invoice Form (New / Edit) ----------
const ALL_COLUMN_IDS = ['sr', 'particulars', 'hsn', 'batch', 'expDate', 'mfgDate', 'unit', 'qty', 'rate', 'discount', 'taxable', 'cgst', 'sgst', 'igst', 'amount'];
const COLUMN_FIELD_LABELS = { sr: 'S.No', particulars: 'Particulars', hsn: 'HSN', batch: 'Batch', expDate: 'Exp Date', mfgDate: 'Mfg Date', unit: 'Unit', qty: 'Qty', rate: 'Rate', discount: 'Discount', taxable: 'Taxable Value', cgst: 'CGST', sgst: 'SGST', igst: 'IGST', amount: 'Amount' };

function buildOneInvoiceRow(visibleColumns, products, row, idx) {
  const prodsOpts = products.map((p) => `<option value="${p.id}" data-name="${p.name}" data-hsn="${p.hsn}" data-rate="${p.rate}" data-gst="${p.gstPercent}" data-unit="${p.unit || 'Pcs'}" ${row.productId === p.id ? 'selected' : ''}>${p.name} - ₹${p.rate}</option>`).join('');
  const hiddenGst = `<td class="col-gst-hidden" style="display:none;padding:0;border:0"><input type="hidden" class="item-gst" value="${row.gstPercent ?? 18}" /></td>`;
  const cells = visibleColumns.map((c) => {
    const id = c.id;
    if (id === 'sr') return `<td class="col-sr">${idx + 1}</td>`;
    if (id === 'particulars') return `<td class="col-particulars"><select class="item-product">${prodsOpts ? '<option value="">Select</option>' + prodsOpts : '<option value="">No products</option>'}</select></td>`;
    if (id === 'hsn') return `<td class="col-hsn"><input type="text" class="item-hsn" readonly value="${row.hsn || ''}" /></td>`;
    if (id === 'batch') return `<td class="col-batch"><input type="text" class="item-batch" value="${row.batch || ''}" placeholder="-" /></td>`;
    if (id === 'expDate') return `<td class="col-expDate"><input type="text" class="item-expDate" value="${row.expDate || ''}" placeholder="DD/MM/YYYY" /></td>`;
    if (id === 'mfgDate') return `<td class="col-mfgDate"><input type="text" class="item-mfgDate" value="${row.mfgDate || ''}" placeholder="DD/MM/YYYY" /></td>`;
    if (id === 'unit') return `<td class="col-unit"><input type="text" class="item-unit" readonly value="${row.unit || 'Pcs'}" /></td>`;
    if (id === 'qty') return `<td class="col-qty"><input type="number" class="item-qty" min="0.01" step="0.01" value="${row.qty ?? 1}" /></td>`;
    if (id === 'rate') return `<td class="col-rate"><input type="number" class="item-rate" min="0" step="0.01" value="${row.rate ?? 0}" /></td>`;
    if (id === 'discount') return `<td class="col-discount"><input type="number" class="item-discount" min="0" step="0.01" value="${row.discount ?? 0}" /></td>`;
    if (id === 'taxable') return `<td class="col-taxable"><span class="item-taxable">${(row.taxable || 0).toFixed(2)}</span></td>`;
    if (id === 'cgst') return `<td class="col-cgst"><span class="item-cgst">${(row.cgst || 0).toFixed(2)}</span></td>`;
    if (id === 'sgst') return `<td class="col-sgst"><span class="item-sgst">${(row.sgst || 0).toFixed(2)}</span></td>`;
    if (id === 'igst') return `<td class="col-igst"><span class="item-igst">${(row.igst || 0).toFixed(2)}</span></td>`;
    if (id === 'amount') return `<td class="col-amount"><span class="item-amount">${(row.amount || 0).toFixed(2)}</span></td>`;
    return `<td class="col-${id}"></td>`;
  }).join('');
  return `<tr class="item-row">${hiddenGst}${cells}<td class="col-actions"><button type="button" class="btn-sm btn-remove-row">×</button></td></tr>`;
}

function buildInvoiceFormTable(visibleColumns, items, products, inv, businessId) {
  const defBusiness = D.getDefaultBusiness();
  const bid = businessId || (inv && inv.businessId) || (defBusiness && defBusiness.id) || '';
  const businesses = D.getBusinesses();
  const invNum = (inv && inv.invoiceNumber) || D.getNextInvoiceNumber(bid);
  const theads = '<th class="col-gst-hidden" style="display:none;padding:0;border:0"></th>' + visibleColumns.map((c) => `<th class="col-${c.id}">${c.label || c.id}</th>`).join('') + '<th class="col-actions"></th>';
  const rowHtml = items.map((row, idx) => buildOneInvoiceRow(visibleColumns, products, row, idx)).join('');
  return { theads, rowHtml, invNum, bid, businesses };
}

function renderInvoiceForm(container, editId) {
  const currentId = D.getCurrentBusinessId();
  const businessId = currentId || (D.getBusinesses()[0] && D.getBusinesses()[0].id);
  const customers = D.getCustomers(businessId);
  const products = D.getProducts(businessId);
  const isEdit = !!editId;
  const inv = isEdit ? D.getInvoiceById(editId) : null;
  const businessIdForForm = (inv && inv.businessId) || businessId;
  const business = D.getBusinessById(businessIdForForm) || D.getDefaultBusiness();
  const visibleColumns = getVisibleColumns(business);
  const summaryRows = (business && business.invoiceSettings && business.invoiceSettings.summaryRows) ? business.invoiceSettings.summaryRows : D.defaultInvoiceSettings().summaryRows;
  const visibleSummary = summaryRows.filter((r) => r.visible !== false);
  const items = (inv && inv.items && inv.items.length) ? inv.items : [{ productId: '', productName: '', hsn: '', unit: 'Pcs', qty: 1, rate: 0, discount: 0, gstPercent: 18, taxable: 0, cgst: 0, sgst: 0, igst: 0, amount: 0 }];
  const built = buildInvoiceFormTable(visibleColumns, items, products, inv, businessIdForForm);
  const businesses = D.getBusinesses();

  const summaryHtml = visibleSummary.map((s) => {
    const id = s.id;
    if (id === 'grandTotal') return `<div class="form-row total"><label>${s.label}</label><span id="grandTotal">0.00</span></div>`;
    if (id === 'subtotal') return `<div class="form-row" data-summary="subtotal"><label>${s.label}</label><span id="subtotal">0.00</span></div>`;
    if (id === 'discountTotal') return `<div class="form-row" data-summary="discountTotal"><label>${s.label}</label><span id="discountTotal">0.00</span></div>`;
    if (id === 'cgstTotal') return `<div class="form-row" data-summary="cgstTotal"><label>${s.label}</label><span id="cgstTotal">0.00</span></div>`;
    if (id === 'sgstTotal') return `<div class="form-row" data-summary="sgstTotal"><label>${s.label}</label><span id="sgstTotal">0.00</span></div>`;
    if (id === 'igstTotal') return `<div class="form-row" data-summary="igstTotal"><label>${s.label}</label><span id="igstTotal">0.00</span></div>`;
    if (id === 'roundOff') return `<div class="form-row" data-summary="roundOff"><label>${s.label}</label><input type="number" name="roundOff" id="roundOff" step="0.01" value="${(inv && inv.roundOff) || 0}" /></div>`;
    return `<div class="form-row" data-summary="${id}"><label>${s.label}</label><span id="${id}">0.00</span></div>`;
  }).join('');

  container.innerHTML = `
    <div class="page-header flex-between">
      <h1>${isEdit ? 'Edit Invoice' : 'New Invoice'}</h1>
      <div>
        ${isEdit ? `<button type="button" class="btn btn-outline btn-danger-outline" id="invoice-delete-btn">Delete Invoice</button>` : ''}
        <a href="#invoices" class="btn btn-outline">← Back to Invoices</a>
      </div>
    </div>
    <form id="invoice-form" class="invoice-form card">
      <div class="form-group">
        <label>Business</label>
        <select name="businessId" id="invoice-business-select">
          ${businesses.map((b) => `<option value="${b.id}" ${b.id === businessIdForForm ? 'selected' : ''}>${b.name}</option>`).join('')}
        </select>
      </div>
      <div class="form-row two-cols">
        <div>
          <label>Invoice Number</label>
          <input type="text" name="invoiceNumber" value="${built.invNum}" readonly />
        </div>
        <div>
          <label>Date</label>
          <input type="date" name="date" value="${(inv && inv.date) || new Date().toISOString().slice(0, 10)}" required />
        </div>
      </div>
      <div class="form-group">
        <label>Bill To (Customer)</label>
        <select name="customerId" required>
          <option value="">Select customer</option>
          ${customers.map((c) => `<option value="${c.id}" data-name="${c.name}" data-address="${(c.address || '').replace(/"/g, '&quot;')}" data-gstin="${c.gstin || ''}" data-state="${c.state || ''}" ${(inv && inv.customerId === c.id) ? 'selected' : ''}>${c.name}</option>`).join('')}
        </select>
      </div>
      <div id="customer-details" class="customer-details muted"></div>

      <h3>Items</h3>
      <table class="table items-table">
        <thead><tr>${built.theads}</tr></thead>
        <tbody id="invoice-items">${built.rowHtml}</tbody>
      </table>
      <button type="button" class="btn btn-outline" id="add-row">+ Add Row</button>

      <div class="totals-section">
        ${summaryHtml}
      </div>

      <div class="form-actions">
        <button type="submit" class="btn btn-primary">${isEdit ? 'Update Invoice' : 'Save Invoice'}</button>
        ${isEdit ? `<button type="button" class="btn btn-outline" id="btn-print-inv">Print</button>` : ''}
      </div>
    </form>
  `;

  const form = $('#invoice-form', container);
  const customerSelect = $('select[name="customerId"]', form);
  const customerDetails = $('#customer-details', container);
  const tbody = $('#invoice-items', container);
  const addRowBtn = $('#add-row', container);

  function updateCustomerDetails() {
    const opt = customerSelect.selectedOptions[0];
    if (!opt || !opt.value) {
      customerDetails.innerHTML = '';
      return;
    }
    customerDetails.innerHTML = `<strong>${opt.dataset.name}</strong><br/>${opt.dataset.address || ''}<br/>GSTIN: ${opt.dataset.gstin || '-'} | State: ${opt.dataset.state || '-'}`;
  }
  customerSelect.addEventListener('change', updateCustomerDetails);
  updateCustomerDetails();

  function recalcRow(row) {
    const qtyInput = $('.item-qty', row);
    const rateInput = $('.item-rate', row);
    const discountInput = $('.item-discount', row);
    const gstEl = $('.item-gst', row);
    const qty = parseFloat(qtyInput?.value) || 0;
    const rate = parseFloat(rateInput?.value) || 0;
    const discount = parseFloat(discountInput?.value) || 0;
    const gst = gstEl && gstEl.value !== '' && gstEl.value !== undefined
      ? (parseFloat(gstEl.value) || 0) : 18;
    const taxable = Math.max(0, qty * rate - discount);
    const gstAmt = (taxable * gst) / 100;
    const cgst = gstAmt / 2;
    const sgst = gstAmt / 2;
    const igst = 0;
    const amount = taxable + cgst + sgst + igst;
    const taxEl = $('.item-taxable', row); if (taxEl) taxEl.textContent = taxable.toFixed(2);
    const cEl = $('.item-cgst', row); if (cEl) cEl.textContent = cgst.toFixed(2);
    const sEl = $('.item-sgst', row); if (sEl) sEl.textContent = sgst.toFixed(2);
    const iEl = $('.item-igst', row); if (iEl) iEl.textContent = igst.toFixed(2);
    const aEl = $('.item-amount', row); if (aEl) aEl.textContent = amount.toFixed(2);
    recalcTotals();
  }

  function recalcTotals() {
    let subtotal = 0, discountTotal = 0, cgstTotal = 0, sgstTotal = 0, igstTotal = 0;
    $$('.item-row', tbody).forEach((row) => {
      const qty = parseFloat($('.item-qty', row)?.value) || 0;
      const rate = parseFloat($('.item-rate', row)?.value) || 0;
      const discount = parseFloat($('.item-discount', row)?.value) || 0;
      const gstEl = $('.item-gst', row);
      const gst = gstEl && gstEl.value !== '' && gstEl.value !== undefined ? (parseFloat(gstEl.value) || 0) : 18;
      const taxable = Math.max(0, qty * rate - discount);
      const gstAmt = (taxable * gst) / 100;
      const cgst = gstAmt / 2;
      const sgst = gstAmt / 2;
      subtotal += taxable;
      discountTotal += discount;
      cgstTotal += cgst;
      sgstTotal += sgst;
    });
    const roundOffEl = $('#roundOff', form);
    const roundOff = roundOffEl ? (parseFloat(roundOffEl.value) || 0) : 0;
    const grandTotal = Math.round(subtotal + cgstTotal + sgstTotal + igstTotal + roundOff);
    const subEl = $('#subtotal', form); if (subEl) subEl.textContent = subtotal.toFixed(2);
    const dEl = $('#discountTotal', form); if (dEl) dEl.textContent = discountTotal.toFixed(2);
    const cEl = $('#cgstTotal', form); if (cEl) cEl.textContent = cgstTotal.toFixed(2);
    const sEl = $('#sgstTotal', form); if (sEl) sEl.textContent = sgstTotal.toFixed(2);
    const iEl = $('#igstTotal', form); if (iEl) iEl.textContent = igstTotal.toFixed(2);
    const gEl = $('#grandTotal', form); if (gEl) gEl.textContent = grandTotal.toFixed(2);
  }

  function bindRowEvents(row) {
    const inputs = ['item-qty', 'item-rate', 'item-discount'];
    inputs.forEach((cls) => {
      const el = $('.' + cls, row);
      if (el) el.addEventListener('input', () => recalcRow(row));
    });
    const gstInput = $('.item-gst', row);
    if (gstInput) gstInput.addEventListener('input', () => recalcRow(row));
    const productSelect = $('.item-product', row);
    if (productSelect) {
      productSelect.addEventListener('change', function () {
        const opt = this.selectedOptions[0];
        if (opt && opt.value) {
          const hsn = $('.item-hsn', row); if (hsn) hsn.value = opt.dataset.hsn || '';
          const rate = $('.item-rate', row); if (rate) rate.value = String(opt.dataset.rate ?? '');
          const unit = $('.item-unit', row); if (unit) unit.value = opt.dataset.unit || 'Pcs';
          const gst = $('.item-gst', row); if (gst) gst.value = String(opt.dataset.gst ?? '18');
          recalcRow(row);
        }
      });
    }
    const removeBtn = $('.btn-remove-row', row);
    if (removeBtn) removeBtn.addEventListener('click', () => {
      if (tbody.querySelectorAll('.item-row').length > 1) {
        row.remove();
        recalcTotals();
        updateSrNumbers();
      }
    });
  }

  function updateSrNumbers() {
    $$('.item-row', tbody).forEach((row, idx) => {
      const sr = $('.col-sr', row);
      if (sr) sr.textContent = idx + 1;
    });
  }

  tbody.querySelectorAll('.item-row').forEach((row) => {
    bindRowEvents(row);
    recalcRow(row);
  });

  const roundOffEl = $('#roundOff', form);
  if (roundOffEl) roundOffEl.addEventListener('input', recalcTotals);

  addRowBtn.addEventListener('click', () => {
    const emptyRow = { productId: '', productName: '', hsn: '', unit: 'Pcs', qty: 1, rate: 0, discount: 0, gstPercent: 18, taxable: 0, cgst: 0, sgst: 0, igst: 0, amount: 0 };
    const newRowHtml = buildOneInvoiceRow(visibleColumns, products, emptyRow, tbody.querySelectorAll('.item-row').length);
    const tr = document.createElement('tr');
    tr.className = 'item-row';
    tr.innerHTML = newRowHtml;
    tbody.appendChild(tr);
    bindRowEvents(tr);
    recalcRow(tr);
    updateSrNumbers();
    recalcTotals();
  });

  recalcTotals();

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const businessId = form.querySelector('[name="businessId"]').value;
    const customerId = customerSelect.value;
    const cust = customers.find((c) => c.id === customerId);
    const items = [];
    $$('.item-row', tbody).forEach((row) => {
      const productSelect = $('.item-product', row);
      const productId = productSelect ? productSelect.value : '';
      const productName = productSelect && productSelect.selectedOptions[0] ? productSelect.selectedOptions[0].text : '';
      const qty = parseFloat($('.item-qty', row)?.value) || 0;
      const rate = parseFloat($('.item-rate', row)?.value) || 0;
      if (!productId || qty <= 0) return;
      const taxable = parseFloat($('.item-taxable', row)?.textContent) || 0;
      const cgst = parseFloat($('.item-cgst', row)?.textContent) || 0;
      const sgst = parseFloat($('.item-sgst', row)?.textContent) || 0;
      const igst = parseFloat($('.item-igst', row)?.textContent) || 0;
      const amount = parseFloat($('.item-amount', row)?.textContent) || 0;
      const gstPercent = parseFloat($('.item-gst', row)?.value) || 18;
      const unitEl = $('.item-unit', row);
      const discountEl = $('.item-discount', row);
      const batchEl = $('.item-batch', row);
      const expDateEl = $('.item-expDate', row);
      const mfgDateEl = $('.item-mfgDate', row);
      items.push({
        productId,
        productName,
        hsn: $('.item-hsn', row)?.value || '',
        batch: batchEl ? batchEl.value.trim() : '',
        expDate: expDateEl ? expDateEl.value.trim() : '',
        mfgDate: mfgDateEl ? mfgDateEl.value.trim() : '',
        unit: unitEl ? unitEl.value : 'Pcs',
        qty,
        rate,
        discount: discountEl ? (parseFloat(discountEl.value) || 0) : 0,
        gstPercent,
        taxable,
        cgst,
        sgst,
        igst,
        amount,
      });
    });
    const roundOffEl = $('#roundOff', form);
    const roundOff = roundOffEl ? (parseFloat(roundOffEl.value) || 0) : 0;
    const grandTotalEl = $('#grandTotal', form);
    const grandTotal = grandTotalEl ? (parseFloat(grandTotalEl.textContent) || 0) : 0;
    const payload = {
      businessId,
      invoiceNumber: form.invoiceNumber.value,
      date: form.date.value,
      customerId,
      customerName: cust ? cust.name : '',
      customerAddress: cust ? cust.address : '',
      customerGstin: cust ? cust.gstin : '',
      customerState: cust ? cust.state : '',
      items,
      roundOff,
      grandTotal,
    };
    if (isEdit) {
      D.updateInvoice(editId, payload);
      window.location.hash = 'invoices';
    } else {
      D.addInvoice(payload);
      window.location.hash = 'invoices';
    }
  });

  const btnPrint = $('#btn-print-inv', container);
  if (btnPrint) btnPrint.addEventListener('click', () => printInvoice(editId));
  const btnDelete = $('#invoice-delete-btn', container);
  if (btnDelete) btnDelete.addEventListener('click', () => {
    if (confirm('Delete this invoice? This cannot be undone.')) {
      D.deleteInvoice(editId);
      window.location.hash = 'invoices';
    }
  });
}

// ---------- Amount in words (for print) ----------
function amountInWords(num) {
  const n = Math.floor(Math.abs(num));
  if (n === 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  function toHundreds(x) {
    if (x === 0) return '';
    if (x < 10) return ones[x];
    if (x < 20) return teens[x - 10];
    if (x < 100) return (tens[Math.floor(x / 10)] + ' ' + ones[x % 10]).trim();
    return (ones[Math.floor(x / 100)] + ' Hundred ' + toHundreds(x % 100)).trim();
  }
  if (n < 1000) return toHundreds(n);
  if (n < 100000) return (toHundreds(Math.floor(n / 1000)) + ' Thousand ' + toHundreds(n % 1000)).trim();
  if (n < 10000000) return (toHundreds(Math.floor(n / 100000)) + ' Lakh ' + amountInWords(n % 100000)).trim();
  return (toHundreds(Math.floor(n / 10000000)) + ' Crore ' + amountInWords(n % 10000000)).trim();
}

// ---------- Print Invoice ----------
function printInvoice(id) {
  const inv = D.getInvoiceById(id);
  if (!inv) return;
  const business = (inv.businessId && D.getBusinessById(inv.businessId)) || D.getDefaultBusiness();
  const company = business ? { name: business.name, address: business.address, gstin: business.gstin, state: business.state } : D.getCompany();
  const settings = business && business.invoiceSettings ? business.invoiceSettings : D.defaultInvoiceSettings();
  let visibleCols = (settings.columns || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).filter((c) => c.visible !== false);
  visibleCols = visibleCols.map((c) => ({ ...c, id: ALL_COLUMN_IDS.includes(c.id) ? c.id : 'qty' }));
  const visibleSummary = (settings.summaryRows || []).filter((r) => r.visible !== false);
  const headerFields = (settings.headerFields || []).filter((h) => h.visible !== false);

  const headerHtml = headerFields.map((h) => {
    if (h.id === 'invoiceNumber') return `${h.label}: ${inv.invoiceNumber}`;
    if (h.id === 'date') return `${h.label}: ${inv.date}`;
    if (h.id === 'dueDate') return inv.dueDate ? `${h.label}: ${inv.dueDate}` : '';
    if (h.id === 'poNumber') return inv.poNumber ? `${h.label}: ${inv.poNumber}` : '';
    return '';
  }).filter(Boolean).join('<br/>');

  const colMap = {
    sr: (it, i) => i + 1,
    particulars: (it) => it.productName || '-',
    hsn: (it) => it.hsn || '-',
    batch: (it) => it.batch || '-',
    expDate: (it) => it.expDate || '-',
    mfgDate: (it) => it.mfgDate || '-',
    unit: (it) => it.unit || 'Pcs',
    qty: (it) => it.qty,
    rate: (it) => it.rate != null ? it.rate.toFixed(2) : '-',
    discount: (it) => it.discount != null ? it.discount.toFixed(2) : '0.00',
    taxable: (it) => it.taxable != null ? it.taxable.toFixed(2) : '0.00',
    cgst: (it) => it.cgst != null ? it.cgst.toFixed(2) : '0.00',
    sgst: (it) => it.sgst != null ? it.sgst.toFixed(2) : '0.00',
    igst: (it) => it.igst != null ? it.igst.toFixed(2) : '0.00',
    amount: (it) => it.amount != null ? it.amount.toFixed(2) : '0.00',
  };
  const theads = visibleCols.map((c) => `<th>${c.label || c.id}</th>`).join('');
  const tbodyRows = (inv.items || []).map((it, i) => {
    const tds = visibleCols.map((c) => {
      const val = colMap[c.id] ? colMap[c.id](it, i) : '';
      const right = ['taxable', 'rate', 'discount', 'cgst', 'sgst', 'igst', 'amount', 'qty'].indexOf(c.id) >= 0;
      return `<td class="${right ? 'text-right' : ''}">${val}</td>`;
    }).join('');
    return `<tr>${tds}</tr>`;
  }).join('');

  let subtotal = 0, cgstT = 0, sgstT = 0, igstT = 0;
  (inv.items || []).forEach((it) => {
    subtotal += it.taxable || 0;
    cgstT += it.cgst || 0;
    sgstT += it.sgst || 0;
    igstT += it.igst || 0;
  });
  const discountT = (inv.items || []).reduce((s, it) => s + (it.discount || 0), 0);
  const summaryRowsHtml = visibleSummary.map((s) => {
    let val = '';
    if (s.id === 'subtotal') val = subtotal.toFixed(2);
    else if (s.id === 'discountTotal') val = discountT.toFixed(2);
    else if (s.id === 'cgstTotal') val = cgstT.toFixed(2);
    else if (s.id === 'sgstTotal') val = sgstT.toFixed(2);
    else if (s.id === 'igstTotal') val = igstT.toFixed(2);
    else if (s.id === 'roundOff') val = (inv.roundOff || 0).toFixed(2);
    else if (s.id === 'grandTotal') val = '₹' + (inv.grandTotal || 0).toFixed(2);
    const isGrand = s.id === 'grandTotal';
    return `<tr class="${isGrand ? 'grand' : ''}"><td>${s.label}</td><td class="text-right">${val}</td></tr>`;
  }).join('');

  const accent = (settings.printPrimaryColor && /^#([0-9A-Fa-f]{3}){1,2}$/.test(settings.printPrimaryColor)) ? settings.printPrimaryColor : '#0d9488';
  const fontFamily = settings.printFont || 'system-ui, Arial, sans-serif';
  const titleText = (settings.printTitle && settings.printTitle.trim()) || 'TAX INVOICE';
  const logoHeight = Math.min(120, Math.max(24, parseInt(settings.printLogoMaxHeight, 10) || 56));
  const tableStyle = settings.printTableStyle === 'minimal' ? 'minimal' : 'bordered';
  const thankYou = (settings.printThankYouText && settings.printThankYouText.trim()) || '';
  const showTagline = settings.showTagline && business && business.tagline;
  const showBank = settings.showBankDetails && business && (business.bankName || business.bankAccountNo || business.bankIfsc || business.upiId);
  const showAmtWords = settings.showAmountInWords !== false;
  const amountWordsStr = showAmtWords && (inv.grandTotal != null) ? amountInWords(inv.grandTotal) : '';

  const tableCss = tableStyle === 'minimal'
    ? `table.items{ border-collapse:collapse; }
       .items th{ border-bottom:2px solid ${accent}; padding:10px 12px; text-align:left; font-weight:600; }
       .items td{ border-bottom:1px solid #e5e7eb; padding:10px 12px; }
       .items tbody tr:last-child td{ border-bottom:2px solid ${accent}; }`
    : `table.items th, table.items td{ border:1px solid #e5e7eb; padding:10px 12px; }
       table.items th{ background:${accent}12; }`;

  const theme = settings.printTemplate || 'modern';
  const logoPos = settings.printLogoPosition || 'left';
  const headerLayout = settings.printHeaderLayout || 'standard';
  const hasWatermark = settings.printWatermark && business && business.logo;
  const sigLabel = settings.printSignatureLabel || '';

  const logoAlignStyle = logoPos === 'center' ? 'margin: 0 auto;' : logoPos === 'right' ? 'margin-left: auto;' : '';
  const watermarkCss = hasWatermark ? `
    .watermark-bg {
      position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
      opacity: 0.05; z-index: -1; width: 60%; height: 60%; pointer-events: none;
      background-image: url('${business.logo}'); background-repeat: no-repeat;
      background-position: center; background-size: contain;
    }
  ` : '';
  const watermarkHtml = hasWatermark ? `<div class="watermark-bg"></div>` : '';

  const sigCss = sigLabel ? `
    .signature-block { width: 220px; text-align: center; float: right; margin-top: 50px; page-break-inside: avoid; }
    .sig-line { border-bottom: 1px solid #111; height: 40px; margin-bottom: 8px; }
    .sig-label { font-size: 13px; font-weight: 600; color: #555; text-transform: uppercase; letter-spacing: 1px; }
  ` : '';
  const sigHtml = sigLabel ? `
    <div class="signature-block">
      <div class="sig-line"></div>
      <div class="sig-label">${sigLabel}</div>
    </div>
    <div style="clear:both;"></div>
  ` : '';

  let htmlContent = '';

  const bankHtml = showBank ? `<div class="bank-details"><strong>Bank details</strong><br/>${business.bankName ? business.bankName + '<br/>' : ''}${business.bankAccountNo ? 'A/c No: ' + business.bankAccountNo + '<br/>' : ''}${business.bankIfsc ? 'IFSC: ' + business.bankIfsc + '<br/>' : ''}${business.upiId ? 'UPI: ' + business.upiId : ''}</div>` : '';
  const termsHtml = settings.showTerms && settings.termsText ? `<div class="terms-notes"><strong>Terms:</strong> ${settings.termsText}</div>` : '';
  const notesHtml = settings.showNotes && settings.notesText ? `<div class="terms-notes"><strong>Notes:</strong> ${settings.notesText}</div>` : '';
  const billToHtml = settings.showBillTo !== false ? `<div class="bill-to"><strong>Bill To</strong>${inv.customerName ? '<br/>' + inv.customerName : ''}${inv.customerAddress ? '<br/>' + inv.customerAddress : ''}<br/>GSTIN: ${inv.customerGstin || '-'} | State: ${inv.customerState || '-'}</div>` : '';

  const logoImg = business && business.logo
    ? `<img src="${business.logo}" alt="Logo" style="max-height:${logoHeight}px; max-width:200px; margin-bottom:10px; display:block; object-fit:contain; ${logoAlignStyle}" />`
    : '';

  const flexHeaderCss = headerLayout === 'flipped' 
    ? 'flex-direction: row-reverse; text-align: right;'
    : headerLayout === 'centered'
    ? 'flex-direction: column; align-items: center; text-align: center;'
    : 'justify-content: space-between; align-items: flex-start;';

  const flexHeaderTitleCss = headerLayout === 'flipped'
    ? 'text-align: left;'
    : headerLayout === 'centered'
    ? 'text-align: center; margin-top: 20px;'
    : 'text-align: right;';

  if (theme === 'advance') {
    htmlContent = `
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice ${inv.invoiceNumber}</title>
      <style>
        *{ box-sizing:border-box; margin:0; padding:0; }
        body{ font-family:${fontFamily}; font-size:14px; line-height:1.5; color:#1f2937; background:#fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .page{ max-width:850px; margin:0 auto; background:#fff; }
        .banner{ background:${accent}; color:#fff; padding:40px; display:flex; justify-content:space-between; align-items:flex-start; }
        .banner .logo img{ max-height:${logoHeight}px; max-width:180px; margin-bottom:12px; background:#fff; padding:4px; border-radius:4px; }
        .banner .company h2{ font-size:1.5rem; font-weight:700; margin-bottom:4px; color:#fff; }
        .banner .company p{ font-size:13px; color:rgba(255,255,255,0.9); }
        .banner .invoice-info{ text-align:right; }
        .banner .invoice-info h1{ font-size:2rem; font-weight:800; letter-spacing:1px; margin-bottom:12px; text-transform:uppercase; color:#fff; }
        .banner .invoice-info p{ font-size:13px; color:rgba(255,255,255,0.9); line-height:1.6; }
        .content{ padding:40px; }
        .bill-to{ margin-bottom:30px; font-size:13px; }
        .bill-to strong{ color:${accent}; font-size:14px; display:block; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px; }
        table.items{ width:100%; border-collapse:collapse; margin-bottom:30px; font-size:13px; }
        table.items th{ background:#f3f4f6; color:#374151; padding:12px; text-align:left; font-weight:600; text-transform:uppercase; font-size:11px; letter-spacing:0.5px; }
        table.items td{ padding:12px; border-bottom:1px solid #e5e7eb; }
        .text-right{ text-align:right; }
        .summary-section{ display:flex; justify-content:space-between; align-items:flex-start; gap:40px; margin-top:10px; page-break-inside: avoid; }
        .summary-left{ flex:1; }
        .summary-right{ width:300px; }
        table.totals{ width:100%; border-collapse:collapse; }
        table.totals td{ padding:8px 0; font-size:13px; }
        table.totals .grand{ font-size:1.25rem; font-weight:700; padding-top:12px; border-top:2px solid ${accent}; color:${accent}; }
        .bank-details{ background:#f9fafb; padding:16px; border-radius:8px; font-size:12px; color:#4b5563; border-left:4px solid ${accent}; }
        .bank-details strong{ color:#111827; font-size:13px; display:block; margin-bottom:4px; }
        .amount-words{ margin-top:16px; font-style:italic; color:#4b5563; background:#f3f4f6; padding:12px; border-radius:4px; font-size:13px; }
        .terms-notes{ margin-top:24px; font-size:12px; color:#6b7280; }
        .terms-notes strong{ color:#374151; }
        .footer{ margin-top:40px; padding-top:20px; font-size:13px; color:#9ca3af; text-align:center; border-top:1px solid #e5e7eb; }
        @media print{ @page{margin:0;} body{padding:0;} .page{width:100%; max-width:none;} .banner{padding:30px;} .content{padding:30px;} }
      </style></head><body>
      <div class="page">
        <div class="banner">
          <div class="company">
            <div class="logo">${logoImg}</div>
            <h2>${company.name}</h2>
            ${showTagline ? `<p style="margin-bottom:8px;font-weight:500;">${business.tagline}</p>` : ''}
            <p>${company.address || ''}<br/>GSTIN: ${company.gstin || '-'}<br/>State: ${company.state || '-'}</p>
          </div>
          <div class="invoice-info">
            <h1>${titleText}</h1>
            <p>${headerHtml}</p>
          </div>
        </div>
        <div class="content">
          ${billToHtml}
          <table class="items">
            <thead><tr>${theads}</tr></thead>
            <tbody>${tbodyRows}</tbody>
          </table>
          <div class="summary-section">
            <div class="summary-left">
              ${bankHtml}
              ${showAmtWords && amountWordsStr ? `<div class="amount-words"><strong>Amount in words:</strong> Rupees ${amountWordsStr} only.</div>` : ''}
              ${termsHtml}${notesHtml}
            </div>
            <div class="summary-right">
              <table class="totals">${summaryRowsHtml}</table>
            </div>
          </div>
          ${thankYou ? `<div class="footer">${thankYou}</div>` : ''}
        </div>
      </div>
      </body></html>
    `;
  } else if (theme === 'smart') {
    htmlContent = `
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice ${inv.invoiceNumber}</title>
      <style>
        *{ box-sizing:border-box; margin:0; padding:0; }
        body{ font-family:${fontFamily}; font-size:13px; line-height:1.5; color:#333; padding:40px; max-width:850px; margin:0 auto; background:#fff; }
        .header-grid{ display:grid; grid-template-columns:1fr 1fr; gap:20px; margin-bottom:40px; }
        .company-col{ display:flex; flex-direction:column; justify-content:center; }
        .title-col{ text-align:right; display:flex; flex-direction:column; justify-content:center; }
        h1.title{ font-size:2.2rem; font-weight:300; color:${accent}; letter-spacing:2px; margin-bottom:10px; text-transform:uppercase; }
        .meta-table{ margin-left:auto; text-align:right; border-collapse:collapse; }
        .meta-table td{ padding:4px 0 4px 16px; border-bottom:1px solid #eee; }
        .company-name{ font-size:1.4rem; font-weight:700; color:#111; margin-bottom:4px; }
        .divider{ height:4px; background:${accent}; width:60px; margin-bottom:16px; }
        .info-grid{ display:grid; grid-template-columns:1fr 1fr; gap:40px; margin-bottom:30px; background:#fafafa; padding:20px; border-radius:8px; }
        .info-block strong{ color:${accent}; display:block; margin-bottom:8px; text-transform:uppercase; font-size:11px; letter-spacing:1px; }
        table.items{ width:100%; border-collapse:collapse; margin-bottom:30px; }
        table.items th{ border-top:2px solid ${accent}; border-bottom:2px solid ${accent}; padding:12px; text-align:left; font-weight:600; color:${accent}; }
        table.items td{ padding:12px; border-bottom:1px solid #eee; }
        .text-right{ text-align:right; }
        .summary-grid{ display:grid; grid-template-columns:1.5fr 1fr; gap:40px; page-break-inside: avoid; }
        table.totals{ width:100%; border-collapse:collapse; }
        table.totals td{ padding:8px 0; border-bottom:1px solid #f5f5f5; }
        table.totals .grand{ font-size:1.2rem; font-weight:700; color:${accent}; border-bottom:none; border-top:2px solid ${accent}; }
        table.totals .grand td{ padding-top:12px; }
        .bank-details{ font-size:12px; color:#555; }
        .amount-words{ font-style:italic; margin-top:12px; color:#666; font-size:12px; }
        .terms-notes{ margin-top:20px; font-size:11px; color:#777; }
        .footer{ margin-top:40px; text-align:center; color:#999; font-size:12px; letter-spacing:1px; text-transform:uppercase; }
        @media print{ body{padding:0;} }
      </style></head><body>
        <div class="header-grid">
          <div class="company-col">
            ${business && business.logo ? `<img src="${business.logo}" style="max-height:${logoHeight}px; max-width:180px; margin-bottom:16px;" />` : ''}
            <div class="company-name">${company.name}</div>
            ${showTagline ? `<div style="font-weight:600; color:#555; margin-bottom:4px;">${business.tagline}</div>` : ''}
            <div style="color:#666;">${company.address || ''}<br/>GSTIN: ${company.gstin || '-'}<br/>State: ${company.state || '-'}</div>
          </div>
          <div class="title-col">
            <h1 class="title">${titleText}</h1>
            <table class="meta-table">
              ${headerFields.map((h) => {
                let val = '';
                if (h.id === 'invoiceNumber') val = inv.invoiceNumber;
                else if (h.id === 'date') val = inv.date;
                else if (h.id === 'dueDate') val = inv.dueDate;
                else if (h.id === 'poNumber') val = inv.poNumber;
                return val ? `<tr><td style="color:#888;">${h.label}</td><td style="font-weight:600; color:#111;">${val}</td></tr>` : '';
              }).join('')}
            </table>
          </div>
        </div>
        ${settings.showBillTo !== false ? `<div class="info-grid"><div class="info-block"><strong>Billed To</strong><div style="font-weight:600;font-size:14px;">${inv.customerName || ''}</div>${inv.customerAddress || ''}<br/>GSTIN: ${inv.customerGstin || '-'}</div><div class="info-block"><strong>Place of Supply</strong>${inv.customerState || company.state || '-'}</div></div>` : ''}
        <table class="items">
          <thead><tr>${theads}</tr></thead>
          <tbody>${tbodyRows}</tbody>
        </table>
        <div class="summary-grid">
          <div>
            ${showAmtWords && amountWordsStr ? `<div class="amount-words"><strong>Amount in words:</strong> Rupees ${amountWordsStr} only.</div><br/>` : ''}
            ${showBank ? `<div class="bank-details"><strong>Bank details:</strong><br/>${business.bankName ? business.bankName + '<br/>' : ''}${business.bankAccountNo ? 'A/c: ' + business.bankAccountNo + '<br/>' : ''}${business.bankIfsc ? 'IFSC: ' + business.bankIfsc + '<br/>' : ''}${business.upiId ? 'UPI: ' + business.upiId : ''}</div>` : ''}
            ${termsHtml}${notesHtml}
          </div>
          <div>
            <table class="totals">${summaryRowsHtml}</table>
          </div>
        </div>
        ${thankYou ? `<div class="footer">${thankYou}</div>` : ''}
      </body></html>
    `;
  } else if (theme === 'standard') {
    htmlContent = `
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice ${inv.invoiceNumber}</title>
      <style>
        *{ box-sizing:border-box; }
        body{ font-family:${fontFamily}; font-size:14px; line-height:1.5; color:#000; padding:30px; max-width:800px; margin:0 auto; background:#fff; }
        .header-table{ width:100%; margin-bottom:20px; border-bottom:2px solid #000; padding-bottom:10px; }
        .company-name{ font-size:1.5rem; font-weight:bold; margin-bottom:4px; text-transform:uppercase; color:${accent}; }
        .invoice-title{ font-size:1.5rem; font-weight:bold; text-transform:uppercase; text-align:right; }
        .info-table{ width:100%; margin-bottom:20px; border-collapse:collapse; }
        .info-table td{ vertical-align:top; width:50%; }
        .box{ border:1px solid #000; padding:10px; height:100%; }
        table.items{ width:100%; border-collapse:collapse; margin-bottom:20px; border:1px solid #000; }
        table.items th, table.items td{ border:1px solid #000; padding:8px; }
        table.items th{ background:#f0f0f0; text-align:center; font-weight:bold; }
        .text-right{ text-align:right; }
        .summary-container{ display:flex; justify-content:flex-end; }
        table.totals{ width:300px; border-collapse:collapse; border:1px solid #000; }
        table.totals td{ border:1px solid #000; padding:8px; }
        table.totals .grand{ font-weight:bold; background:#f0f0f0; }
        .footer-blocks{ display:flex; justify-content:space-between; margin-top:20px; gap:20px; page-break-inside:avoid; }
        .block{ border:1px solid #000; padding:10px; flex:1; font-size:13px; }
        .block strong{ text-decoration:underline; display:block; margin-bottom:6px; }
        .amount-words{ margin-bottom:10px; font-weight:bold; }
        .footer-text{ margin-top:30px; text-align:center; font-style:italic; }
        @media print{ body{padding:0;} }
      </style></head><body>
        <table class="header-table">
          <tr>
            <td style="vertical-align:top;">
              ${business && business.logo ? `<img src="${business.logo}" style="max-height:${logoHeight}px; max-width:180px; margin-bottom:8px;" />` : ''}
              <div class="company-name">${company.name}</div>
              ${showTagline ? `<div>${business.tagline}</div>` : ''}
              <div>${company.address || ''}<br/>GSTIN: ${company.gstin || '-'}<br/>State: ${company.state || '-'}</div>
            </td>
            <td style="vertical-align:top; text-align:right;">
              <div class="invoice-title">${titleText}</div>
              <div style="margin-top:10px; text-align:right;">
                ${headerHtml.replace(/<br\/>/g, '<div style="margin-top:4px;"></div>')}
              </div>
            </td>
          </tr>
        </table>
        <table class="info-table">
          <tr>
            <td style="padding-right:10px;">
              <div class="box">
                <strong>Bill To:</strong><br/>
                ${inv.customerName ? `<b>${inv.customerName}</b><br/>` : ''}
                ${inv.customerAddress ? inv.customerAddress + '<br/>' : ''}
                GSTIN: ${inv.customerGstin || '-'}<br/>
                State: ${inv.customerState || '-'}
              </div>
            </td>
            <td style="padding-left:10px;">
              <div class="box">
                <strong>Place of Supply:</strong> ${inv.customerState || company.state || '-'}<br/>
              </div>
            </td>
          </tr>
        </table>
        <table class="items">
          <thead><tr>${theads}</tr></thead>
          <tbody>${tbodyRows.replace(/class="text-right"/g, 'style="text-align:right;"')}</tbody>
        </table>
        <div class="summary-container">
          <table class="totals">${summaryRowsHtml}</table>
        </div>
        <div class="footer-blocks">
          <div class="block">
            ${showAmtWords && amountWordsStr ? `<div class="amount-words">Amount in words: Rupees ${amountWordsStr} only.</div>` : ''}
            ${showBank ? `<strong>Bank Details</strong>${business.bankName ? business.bankName + '<br/>' : ''}${business.bankAccountNo ? 'A/c: ' + business.bankAccountNo + '<br/>' : ''}${business.bankIfsc ? 'IFSC: ' + business.bankIfsc + '<br/>' : ''}${business.upiId ? 'UPI: ' + business.upiId : ''}` : '<em>No bank details provided.</em>'}
          </div>
          <div class="block">
            <strong>Terms & Conditions</strong>
            ${settings.termsText || '1. Goods once sold will not be taken back.<br/>2. All disputes subject to local jurisdiction.'}
            ${notesHtml ? `<br/><strong>Notes</strong>${settings.notesText}` : ''}
          </div>
        </div>
        ${thankYou ? `<div class="footer-text">${thankYou}</div>` : ''}
      </body></html>
    `;
  } else if (theme === 'creative') {
    htmlContent = `
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice ${inv.invoiceNumber}</title>
      <style>
        *{ box-sizing:border-box; margin:0; padding:0; }
        body{ font-family:${fontFamily}; font-size:13px; line-height:1.6; color:#374151; background:#fff; padding:40px; max-width:850px; margin:0 auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .header{ display:flex; justify-content:space-between; align-items:center; margin-bottom:40px; position:relative; }
        .logo-wrap{ max-width:250px; }
        .title-wrap{ background:${accent}1A; padding:20px 40px; border-radius:40px 0 0 40px; margin-right:-40px; text-align:right; min-width:300px; border-left:4px solid ${accent}; }
        .title-wrap h1{ color:${accent}; font-size:2rem; font-weight:800; letter-spacing:1px; margin-bottom:4px; text-transform:uppercase; }
        .title-wrap p{ color:#4b5563; font-size:12px; }
        .company-details{ margin-bottom:40px; }
        .company-name{ font-size:1.25rem; font-weight:700; color:#111827; margin-bottom:4px; }
        .bill-meta-grid{ display:grid; grid-template-columns:1fr 1fr; gap:30px; margin-bottom:40px; }
        .box{ background:#f9fafb; padding:20px; border-radius:16px; border:1px solid #e5e7eb; }
        .box strong{ display:block; font-size:11px; text-transform:uppercase; letter-spacing:1px; color:${accent}; margin-bottom:8px; }
        table.items{ width:100%; border-collapse:separate; border-spacing:0; margin-bottom:30px; }
        table.items th{ border-bottom:2px solid ${accent}; padding:12px; text-align:left; font-weight:600; color:#111827; }
        table.items td{ padding:12px; border-bottom:1px dashed #e5e7eb; }
        .text-right{ text-align:right; }
        .summary-container{ display:flex; justify-content:space-between; align-items:flex-start; margin-top:20px; page-break-inside:avoid; gap:40px; }
        .summary-left{ flex:1; }
        .summary-right{ width:320px; background:${accent}0A; padding:20px; border-radius:16px; border:1px solid ${accent}33; }
        table.totals{ width:100%; border-collapse:collapse; }
        table.totals td{ padding:8px 0; }
        table.totals .grand{ font-size:1.25rem; font-weight:700; color:${accent}; border-top:1px solid ${accent}40; }
        table.totals .grand td{ padding-top:12px; margin-top:4px; }
        .bank-details{ margin-bottom:16px; font-size:12px; color:#4b5563; }
        .bank-details strong{ color:#111827; display:block; margin-bottom:4px; }
        .terms-notes{ font-size:12px; color:#6b7280; }
        .terms-notes strong{ color:#374151; }
        .amount-words{ font-style:italic; margin-bottom:16px; font-weight:500; color:${accent}; }
        .footer{ margin-top:40px; text-align:center; font-size:12px; color:#9ca3af; padding-top:20px; border-top:1px solid #e5e7eb; }
        @media print{ body{padding:20px;} .title-wrap{margin-right:-20px;} }
      </style></head><body>
        <div class="header">
          <div class="logo-wrap">
            ${business && business.logo ? `<img src="${business.logo}" style="max-height:${logoHeight}px; max-width:180px;" />` : `<h2 style="font-size:1.5rem;color:${accent};">${company.name}</h2>`}
          </div>
          <div class="title-wrap">
            <h1>${titleText}</h1>
            <p>${headerHtml.replace(/<br\/>/g, ' | ')}</p>
          </div>
        </div>
        <div class="company-details">
          ${business && business.logo ? `<div class="company-name">${company.name}</div>` : ''}
          ${showTagline ? `<div style="color:${accent}; font-weight:500; margin-bottom:8px;">${business.tagline}</div>` : ''}
          <div style="color:#6b7280;">${company.address || ''}<br/>GSTIN: ${company.gstin || '-'}<br/>State: ${company.state || '-'}</div>
        </div>
        <div class="bill-meta-grid">
          ${settings.showBillTo !== false ? `<div class="box"><strong>Billed To</strong><div style="font-weight:600;font-size:14px;color:#111;margin-bottom:4px;">${inv.customerName || ''}</div><div>${inv.customerAddress || ''}</div><div>GSTIN: ${inv.customerGstin || '-'} | State: ${inv.customerState || '-'}</div></div>` : '<div></div>'}
          <div class="box">
            <strong>Payment Info</strong>
            ${showBank ? `<div style="color:#4b5563;">${business.bankName ? business.bankName + '<br/>' : ''}${business.bankAccountNo ? 'A/c: ' + business.bankAccountNo + '<br/>' : ''}${business.bankIfsc ? 'IFSC: ' + business.bankIfsc + '<br/>' : ''}${business.upiId ? 'UPI: ' + business.upiId : ''}</div>` : '<div style="color:#9ca3af;font-style:italic;">No payment info provided.</div>'}
          </div>
        </div>
        <table class="items">
          <thead><tr>${theads}</tr></thead>
          <tbody>${tbodyRows}</tbody>
        </table>
        <div class="summary-container">
          <div class="summary-left">
            ${showAmtWords && amountWordsStr ? `<div class="amount-words">Amount in words: Rupees ${amountWordsStr} only.</div>` : ''}
            ${settings.showTerms && settings.termsText ? `<div class="terms-notes"><strong>Terms:</strong><br/>${settings.termsText}</div>` : ''}
            ${settings.showNotes && settings.notesText ? `<div class="terms-notes" style="margin-top:12px;"><strong>Notes:</strong><br/>${settings.notesText}</div>` : ''}
          </div>
          <div class="summary-right">
            <table class="totals">${summaryRowsHtml}</table>
          </div>
        </div>
        ${thankYou ? `<div class="footer">${thankYou}</div>` : ''}
      </body></html>
    `;
  } else if (theme === 'elegant') {
    const elegantFont = fontFamily.toLowerCase().includes('serif') ? fontFamily : '"Georgia", "Times New Roman", serif';
    htmlContent = `
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice ${inv.invoiceNumber}</title>
      <style>
        *{ box-sizing:border-box; margin:0; padding:0; }
        body{ font-family:${elegantFont}; font-size:13px; line-height:1.6; color:#222; background:#fff; padding:50px; max-width:800px; margin:0 auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .header{ text-align:center; padding-bottom:40px; margin-bottom:40px; position:relative; }
        .header::after{ content:''; position:absolute; bottom:0; left:20%; right:20%; height:1px; background:#ddd; }
        .logo-wrap{ margin-bottom:20px; }
        .company-name{ font-size:2.2rem; font-weight:normal; letter-spacing:3px; text-transform:uppercase; color:${accent}; margin-bottom:8px; }
        .company-tagline{ font-style:italic; color:#666; margin-bottom:16px; letter-spacing:1px; }
        .invoice-title{ font-size:1.2rem; letter-spacing:4px; text-transform:uppercase; margin-top:30px; color:#111; }
        .meta-text{ text-align:center; font-size:12px; color:#555; line-height:1.8; margin-top:20px; }
        .bill-to{ text-align:center; margin-bottom:40px; }
        .bill-to strong{ font-weight:normal; text-transform:uppercase; letter-spacing:2px; font-size:10px; color:#777; display:block; margin-bottom:10px; }
        table.items{ width:100%; border-collapse:collapse; margin-bottom:40px; }
        table.items th{ border-top:1px solid #000; border-bottom:1px solid #000; padding:12px; font-weight:normal; text-transform:uppercase; font-size:10px; letter-spacing:1px; color:#555; }
        table.items td{ padding:14px 12px; border-bottom:1px solid #f5f5f5; }
        .text-right{ text-align:right; }
        .summary-container{ display:flex; justify-content:flex-end; page-break-inside:avoid; margin-bottom:50px; }
        table.totals{ width:350px; border-collapse:collapse; }
        table.totals td{ padding:10px 0; border-bottom:1px solid #f5f5f5; color:#444; }
        table.totals .grand{ font-size:1.4rem; color:${accent}; }
        table.totals .grand td{ border-bottom:none; border-top:2px solid #000; padding-top:16px; font-weight:normal; }
        .footer-info{ border-top:1px solid #ddd; padding-top:30px; font-size:11px; color:#555; display:flex; justify-content:space-between; gap:30px; }
        .footer-info > div{ flex:1; }
        .footer-info strong{ text-transform:uppercase; letter-spacing:2px; display:block; margin-bottom:10px; font-weight:normal; color:#111; font-size:10px; }
        .amount-words{ font-style:italic; margin-bottom:20px; text-align:center; font-size:13px; color:#444; }
        .thank-you{ text-align:center; font-style:italic; margin-top:50px; font-size:14px; color:#888; }
        @media print{ body{padding:30px;} }
      </style></head><body>
        <div class="header">
          ${business && business.logo ? `<div class="logo-wrap"><img src="${business.logo}" style="max-height:${logoHeight}px; max-width:200px;" /></div>` : ''}
          <h1 class="company-name">${company.name}</h1>
          ${showTagline ? `<div class="company-tagline">${business.tagline}</div>` : ''}
          <div style="color:#555;">${company.address || ''} <br/> GSTIN: ${company.gstin || '-'} &nbsp;|&nbsp; State: ${company.state || '-'}</div>
          
          <div class="invoice-title">${titleText}</div>
          <div class="meta-text">${headerHtml.replace(/<br\/>/g, ' &nbsp;|&nbsp; ')}</div>
        </div>
        
        ${settings.showBillTo !== false ? `<div class="bill-to"><strong>Billed To</strong><div style="font-size:1.2rem; color:#111; margin-bottom:4px;">${inv.customerName || ''}</div><div style="color:#444;">${inv.customerAddress || ''}</div><div style="color:#666; margin-top:4px;">GSTIN: ${inv.customerGstin || '-'} &nbsp;|&nbsp; State: ${inv.customerState || '-'}</div></div>` : ''}
        
        <table class="items">
          <thead><tr>${theads}</tr></thead>
          <tbody>${tbodyRows}</tbody>
        </table>
        
        ${showAmtWords && amountWordsStr ? `<div class="amount-words">Amount in words: Rupees ${amountWordsStr} only.</div>` : ''}
        
        <div class="summary-container">
          <table class="totals">${summaryRowsHtml}</table>
        </div>
        
        <div class="footer-info">
          <div>
            <strong>Payment Details</strong>
            <div style="line-height:1.8;">
              ${showBank ? `${business.bankName ? business.bankName + '<br/>' : ''}${business.bankAccountNo ? 'A/c: ' + business.bankAccountNo + '<br/>' : ''}${business.bankIfsc ? 'IFSC: ' + business.bankIfsc + '<br/>' : ''}${business.upiId ? 'UPI: ' + business.upiId : ''}` : '<span style="font-style:italic;color:#999;">None provided.</span>'}
            </div>
          </div>
          <div>
            <strong>Terms & Notes</strong>
            <div style="line-height:1.8;">
              ${settings.termsText || '1. Goods once sold will not be taken back.'}
              ${notesHtml ? `<br/><br/>${settings.notesText}` : ''}
            </div>
          </div>
        </div>
        ${thankYou ? `<div class="thank-you">${thankYou}</div>` : ''}
      </body></html>
    `;
  } else if (theme === 'bold') {
    htmlContent = `
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice ${inv.invoiceNumber}</title>
      <style>
        *{ box-sizing:border-box; margin:0; padding:0; }
        body{ font-family:${fontFamily}; font-size:13px; line-height:1.5; color:#111; border-left:30px solid ${accent}; min-height:100vh; background:#fff; padding:50px; max-width:850px; margin:0 auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .header{ display:flex; justify-content:space-between; margin-bottom:60px; align-items:flex-start; }
        h1.title{ font-size:3.5rem; font-weight:900; text-transform:uppercase; color:#111; line-height:1; margin-bottom:16px; letter-spacing:-1px; }
        .invoice-meta{ color:#555; line-height:1.8; }
        .invoice-meta strong{ color:#111; }
        .company-block{ text-align:right; }
        .company-name{ font-size:1.8rem; font-weight:800; color:${accent}; margin-bottom:6px; letter-spacing:-0.5px; }
        .tagline{ font-weight:600; margin-bottom:12px; color:#555; }
        .bill-to{ margin-bottom:40px; padding:24px; background:#f4f4f5; border-radius:0 16px 16px 16px; width:65%; border-left:4px solid ${accent}; }
        .bill-to strong{ display:block; font-size:11px; text-transform:uppercase; letter-spacing:1.5px; color:${accent}; margin-bottom:12px; }
        table.items{ width:100%; border-collapse:collapse; margin-bottom:40px; }
        table.items th{ background:#111; color:#fff; padding:16px 12px; text-align:left; font-weight:600; text-transform:uppercase; font-size:11px; letter-spacing:1px; }
        table.items td{ padding:16px 12px; border-bottom:1px solid #e5e7eb; }
        .text-right{ text-align:right; }
        .bottom-section{ display:flex; justify-content:space-between; gap:50px; page-break-inside:avoid; }
        .bottom-left{ flex:1; }
        .bottom-right{ width:340px; }
        table.totals{ width:100%; border-collapse:collapse; }
        table.totals td{ padding:12px 0; border-bottom:1px solid #f4f4f5; font-size:14px; }
        table.totals .grand{ font-size:1.6rem; background:#111; color:${accent}; font-weight:800; }
        table.totals .grand td{ padding:20px 16px; border:none; }
        .amount-words{ font-style:italic; margin-bottom:24px; font-weight:600; font-size:14px; color:#333; }
        .bank-details{ margin-bottom:24px; }
        .bank-details strong, .terms-notes strong{ display:block; font-size:11px; text-transform:uppercase; letter-spacing:1px; color:#888; margin-bottom:6px; }
        .footer{ margin-top:60px; font-weight:800; font-size:1.2rem; color:#111; }
        @media print{ body{padding:30px 40px; border-left-width:20px;} }
      </style></head><body>
        <div class="header">
          <div>
            <h1 class="title">${titleText}</h1>
            <div class="invoice-meta">${headerHtml}</div>
          </div>
          <div class="company-block">
            ${business && business.logo ? `<img src="${business.logo}" style="max-height:${logoHeight}px; max-width:200px; margin-bottom:16px;" />` : ''}
            <div class="company-name">${company.name}</div>
            ${showTagline ? `<div class="tagline">${business.tagline}</div>` : ''}
            <div style="color:#555;">${company.address || ''}<br/>GSTIN: ${company.gstin || '-'}<br/>State: ${company.state || '-'}</div>
          </div>
        </div>
        ${settings.showBillTo !== false ? `<div class="bill-to"><strong>Billed To</strong><div style="font-size:1.3rem; font-weight:800; margin-bottom:6px; color:#111;">${inv.customerName || ''}</div><div style="color:#444;">${inv.customerAddress || ''}</div><div style="margin-top:6px; color:#666; font-size:12px;">GSTIN: ${inv.customerGstin || '-'} | State: ${inv.customerState || '-'}</div></div>` : ''}
        
        <table class="items">
          <thead><tr>${theads}</tr></thead>
          <tbody>${tbodyRows}</tbody>
        </table>
        
        <div class="bottom-section">
          <div class="bottom-left">
            ${showAmtWords && amountWordsStr ? `<div class="amount-words">Amount in words: Rupees ${amountWordsStr} only.</div>` : ''}
            ${showBank ? `<div class="bank-details"><strong>Bank details</strong><div style="color:#444; line-height:1.6;">${business.bankName ? business.bankName + '<br/>' : ''}${business.bankAccountNo ? 'A/c: ' + business.bankAccountNo + '<br/>' : ''}${business.bankIfsc ? 'IFSC: ' + business.bankIfsc + '<br/>' : ''}${business.upiId ? 'UPI: ' + business.upiId : ''}</div></div>` : ''}
            ${settings.showTerms && settings.termsText ? `<div class="terms-notes"><strong>Terms:</strong><div style="color:#555; line-height:1.6;">${settings.termsText}</div></div>` : ''}
            ${settings.showNotes && settings.notesText ? `<div class="terms-notes" style="margin-top:16px;"><strong>Notes:</strong><div style="color:#555; line-height:1.6;">${settings.notesText}</div></div>` : ''}
          </div>
          <div class="bottom-right">
            <table class="totals">${summaryRowsHtml}</table>
          </div>
        </div>
        ${thankYou ? `<div class="footer">${thankYou}</div>` : ''}
      </body></html>
    `;
  } else if (theme === 'curves') {
    htmlContent = `
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice ${inv.invoiceNumber}</title>
      <style>
        *{ box-sizing:border-box; margin:0; padding:0; }
        body{ font-family:${fontFamily}; font-size:14px; line-height:1.5; color:#333; background:#fff; position:relative; min-height:100vh; padding:40px; overflow:hidden; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .swoosh-top { position:absolute; top:-150px; left:-100px; width:120%; height:300px; background:${accent}; border-radius:50%; z-index:-1; opacity:0.1; }
        .swoosh-bottom { position:absolute; bottom:-150px; right:-100px; width:120%; height:300px; background:${accent}; border-radius:50%; z-index:-1; opacity:0.1; }
        .header{ display:flex; margin-bottom:40px; ${flexHeaderCss} }
        .company-name{ font-size:2rem; font-weight:800; color:${accent}; margin-bottom:4px; }
        .invoice-title-block { ${flexHeaderTitleCss} }
        .invoice-title-block .title{ font-size:2.5rem; font-weight:900; color:${accent}; text-transform:uppercase; letter-spacing:2px; margin-bottom:12px; }
        table.items{ width:100%; border-collapse:collapse; margin-bottom:30px; }
        table.items th{ background:${accent}; color:#fff; padding:12px; text-align:left; text-transform:uppercase; font-size:12px; border:none; }
        table.items td{ padding:12px; border-bottom:1px solid #eee; }
        .totals{ width:300px; float:right; border-collapse:collapse; margin-bottom:30px; }
        .totals td{ padding:8px 12px; }
        .totals .grand{ background:#f9fafb; font-weight:700; font-size:1.1rem; }
        .clearfix::after { content: ""; clear: both; display: table; }
        ${watermarkCss}
        ${sigCss}
      </style></head><body>
      ${watermarkHtml}
      <div class="swoosh-top"></div>
      <div class="swoosh-bottom"></div>
      <div class="header">
        <div class="company">
          ${logoImg}
          <div class="company-name">${company.name}</div>
          ${showTagline ? `<div style="font-weight:600; margin-bottom:4px;">${business.tagline}</div>` : ''}
          <div>${company.address || ''} <br/> GSTIN: ${company.gstin || '-'} | State: ${company.state || '-'}</div>
        </div>
        <div class="invoice-title-block">
          <div class="title">${titleText}</div>
          <div style="line-height:1.6;">${headerHtml}</div>
        </div>
      </div>
      ${billToHtml}
      <table class="items">
        <thead><tr>${theads}</tr></thead>
        <tbody>${tbodyRows}</tbody>
      </table>
      <div class="clearfix">
        <table class="totals">${summaryRowsHtml}</table>
      </div>
      <div>
        ${bankHtml}
        ${showAmtWords && amountWordsStr ? `<div style="margin-top:10px;"><strong>Amount:</strong> Rupees ${amountWordsStr} only.</div>` : ''}
        ${termsHtml}${notesHtml}
      </div>
      ${sigHtml}
      ${thankYou ? `<div style="text-align:center; margin-top:40px; font-weight:600;">${thankYou}</div>` : ''}
      </body></html>
    `;
  } else if (theme === 'stripes') {
    htmlContent = `
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice ${inv.invoiceNumber}</title>
      <style>
        *{ box-sizing:border-box; margin:0; padding:0; }
        body{ font-family:${fontFamily}; font-size:13px; line-height:1.6; color:#333; background:#fff; padding:40px; max-width:850px; margin:0 auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .header{ display:flex; margin-bottom:40px; border-bottom:2px solid #eee; padding-bottom:20px; ${flexHeaderCss} }
        .company-name{ font-size:1.5rem; font-weight:700; color:#111; margin-bottom:4px; }
        .invoice-title-block { ${flexHeaderTitleCss} }
        .invoice-title-block .title{ font-size:2rem; font-weight:300; letter-spacing:1px; color:#555; }
        .bill-to{ display:inline-block; margin-bottom:30px; }
        table.items{ width:100%; border-collapse:collapse; margin-bottom:30px; }
        table.items th{ padding:12px; text-align:left; border-top:2px solid #333; border-bottom:2px solid #333; font-weight:600; text-transform:uppercase; }
        table.items td{ padding:12px; }
        table.items tbody tr:nth-child(even) td { background-color: #f9fafb; }
        table.items tbody tr:last-child td { border-bottom:2px solid #eee; }
        .totals{ width:300px; float:right; border-collapse:collapse; margin-bottom:30px; }
        .totals td{ padding:8px 0; border-bottom:1px solid #eee; }
        .totals .grand{ font-weight:700; font-size:1.1rem; color:#111; border-bottom:none; border-top:2px solid #333; }
        .clearfix::after { content: ""; clear: both; display: table; }
        ${watermarkCss}
        ${sigCss}
      </style></head><body>
      ${watermarkHtml}
      <div class="header">
        <div class="company">
          ${logoImg}
          <div class="company-name">${company.name}</div>
          ${showTagline ? `<div style="color:#666; margin-bottom:4px;">${business.tagline}</div>` : ''}
          <div>${company.address || ''}</div>
        </div>
        <div class="invoice-title-block">
          <div class="title">${titleText}</div>
          <div style="margin-top:8px;">${headerHtml}</div>
        </div>
      </div>
      ${billToHtml}
      <table class="items">
        <thead><tr>${theads}</tr></thead>
        <tbody>${tbodyRows}</tbody>
      </table>
      <div class="clearfix">
        <table class="totals">${summaryRowsHtml}</table>
      </div>
      <div>
        ${bankHtml}
        ${showAmtWords && amountWordsStr ? `<div style="margin-top:10px;">Amount: Rupees ${amountWordsStr} only.</div>` : ''}
        ${termsHtml}${notesHtml}
      </div>
      ${sigHtml}
      ${thankYou ? `<div style="text-align:center; margin-top:40px; color:#888;">${thankYou}</div>` : ''}
      </body></html>
    `;
  } else if (theme === 'block') {
    htmlContent = `
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice ${inv.invoiceNumber}</title>
      <style>
        *{ box-sizing:border-box; margin:0; padding:0; }
        body{ font-family:${fontFamily}; font-size:14px; line-height:1.5; color:#222; background:#fff; max-width:850px; margin:0 auto; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        .top-block{ background:${accent}; color:#fff; padding:40px; display:flex; ${flexHeaderCss} }
        .top-block .company-name{ font-size:1.8rem; font-weight:700; margin-bottom:4px; }
        .top-block .title{ font-size:2.5rem; font-weight:800; letter-spacing:1px; text-transform:uppercase; margin-bottom:12px; }
        .invoice-title-block { ${flexHeaderTitleCss} }
        .content{ padding:40px; }
        table.items{ width:100%; border-collapse:collapse; margin-top:20px; margin-bottom:30px; }
        table.items th{ background:#f1f5f9; padding:12px; text-align:left; font-weight:600; color:#334155; }
        table.items td{ padding:12px; border-bottom:1px solid #e2e8f0; }
        .totals{ width:300px; float:right; border-collapse:collapse; margin-bottom:30px; }
        .totals td{ padding:8px; }
        .totals .grand{ background:#f1f5f9; font-weight:700; font-size:1.1rem; }
        .clearfix::after { content: ""; clear: both; display: table; }
        .logo-img-block { max-height:${logoHeight}px; max-width:200px; margin-bottom:15px; background:#fff; padding:5px; border-radius:4px; }
        ${watermarkCss}
        ${sigCss}
      </style></head><body>
      ${watermarkHtml}
      <div class="top-block">
        <div class="company">
          ${business && business.logo ? `<img src="${business.logo}" class="logo-img-block" style="${logoAlignStyle}" />` : ''}
          <div class="company-name">${company.name}</div>
          ${showTagline ? `<div style="opacity:0.9; margin-bottom:8px;">${business.tagline}</div>` : ''}
          <div style="opacity:0.8;">${company.address || ''} <br/> GSTIN: ${company.gstin || '-'} | State: ${company.state || '-'}</div>
        </div>
        <div class="invoice-title-block">
          <div class="title">${titleText}</div>
          <div style="opacity:0.9; line-height:1.6;">${headerHtml}</div>
        </div>
      </div>
      <div class="content">
        ${billToHtml}
        <table class="items">
          <thead><tr>${theads}</tr></thead>
          <tbody>${tbodyRows}</tbody>
        </table>
        <div class="clearfix">
          <table class="totals">${summaryRowsHtml}</table>
        </div>
        <div>
          ${bankHtml}
          ${showAmtWords && amountWordsStr ? `<div style="margin-top:10px;"><strong>Amount:</strong> Rupees ${amountWordsStr} only.</div>` : ''}
          ${termsHtml}${notesHtml}
        </div>
        ${sigHtml}
        ${thankYou ? `<div style="text-align:center; margin-top:50px; font-weight:600; color:#555;">${thankYou}</div>` : ''}
      </div>
      </body></html>
    `;
  } else {
    // Default 'modern' theme (the previous design)
    htmlContent = `
      <!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice ${inv.invoiceNumber}</title>
      <style>
        *{ box-sizing:border-box; }
        body{ font-family:${fontFamily}; font-size:14px; line-height:1.5; color:#1f2937; padding:28px; max-width:800px; margin:0 auto; background:#fff; }
        .header{ display:flex; justify-content:space-between; align-items:flex-start; gap:24px; margin-bottom:28px; padding-bottom:20px; border-bottom:3px solid ${accent}; ${flexHeaderCss} }
        .company .name{ margin:0 0 6px 0; font-size:1.35rem; font-weight:700; color:${accent}; letter-spacing:-0.02em; }
        .company .meta{ margin:0; font-size:13px; color:#6b7280; }
        .invoice-title-block{ text-align:right; ${flexHeaderTitleCss} }
        .invoice-title-block .title{ margin:0 0 8px 0; font-size:1.25rem; font-weight:700; color:${accent}; }
        .invoice-title-block .meta{ margin:0; font-size:13px; color:#6b7280; }
        .bill-to{ margin-bottom:20px; padding:14px 16px; background:#f9fafb; border-radius:8px; border-left:4px solid ${accent}; font-size:13px; }
        .bill-to strong{ display:block; margin-bottom:6px; color:#374151; }
        table{ width:100%; }
        table.items{ width:100%; border-collapse:collapse; margin:20px 0; font-size:13px; }
        ${tableCss}
        .text-right{ text-align:right; }
        .totals{ margin-left:auto; width:280px; margin-top:8px; }
        .totals td{ padding:6px 0; font-size:13px; }
        .totals .grand{ font-size:1.1rem; font-weight:700; padding-top:10px; border-top:2px solid ${accent}; color:${accent}; }
        .terms-notes{ margin-top:20px; padding:12px 0; font-size:13px; color:#6b7280; border-top:1px solid #e5e7eb; }
        .bank-details{ margin-top:16px; padding:12px 16px; background:#f9fafb; border-radius:8px; font-size:12px; color:#6b7280; }
        .bank-details strong{ color:#374151; }
        .amount-words{ margin-top:10px; font-style:italic; color:#4b5563; }
        .footer{ margin-top:28px; padding-top:16px; font-size:13px; color:#9ca3af; text-align:center; }
        .clearfix::after { content: ""; clear: both; display: table; }
        @media print{ body{padding:16px;} .header{border-bottom-color:${accent};} }
        ${watermarkCss}
        ${sigCss}
      </style></head><body>
      ${watermarkHtml}
      <div class="header">
        <div class="company">
          ${logoImg}
          <h2 class="name">${company.name}</h2>
          ${showTagline ? `<p class="tagline" style="margin:4px 0 8px 0;font-size:12px;color:#6b7280;">${business.tagline}</p>` : ''}
          <p class="meta">${company.address || ''}<br/>GSTIN: ${company.gstin || '-'}<br/>State: ${company.state || '-'}</p>
        </div>
        <div class="invoice-title-block">
          <h2 class="title">${titleText}</h2>
          <p class="meta">${headerHtml}</p>
        </div>
      </div>
      ${billToHtml}
      <table class="items">
        <thead><tr>${theads}</tr></thead>
        <tbody>${tbodyRows}</tbody>
      </table>
      <div class="clearfix">
        <table class="totals">${summaryRowsHtml}</table>
      </div>
      ${bankHtml}
      ${showAmtWords && amountWordsStr ? `<p class="amount-words"><strong>Amount in words:</strong> Rupees ${amountWordsStr} only.</p>` : ''}
      ${termsHtml}
      ${notesHtml}
      ${sigHtml}
      ${thankYou ? `<p class="footer">${thankYou}</p>` : ''}
      </body></html>
    `;
  }

  const win = window.open('', '_blank');
  win.document.write(htmlContent);
  win.document.close();
  win.focus();
  setTimeout(() => {
    win.print();
    win.close();
  }, 300);
}

// ---------- Customers ----------
function renderCustomers(container) {
  const currentId = D.getCurrentBusinessId();
  const customers = D.getCustomers(currentId);
  container.innerHTML = `
    <div class="page-header flex-between">
      <h1>Customers</h1>
      <button type="button" class="btn btn-primary" id="btn-add-customer">+ Add Customer</button>
    </div>
    <div class="card">
      <table class="table">
        <thead><tr><th>Name</th><th>Address</th><th>GSTIN</th><th>State</th><th>Phone</th><th></th></tr></thead>
        <tbody>
          ${customers.map((c) => `
            <tr>
              <td>${c.name}</td>
              <td>${c.address || '-'}</td>
              <td>${c.gstin || '-'}</td>
              <td>${c.state || '-'}</td>
              <td>${c.phone || '-'}</td>
              <td><button class="btn-sm btn-edit-cust" data-id="${c.id}">Edit</button> <button class="btn-sm btn-del-cust" data-id="${c.id}">Delete</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div id="customer-modal" class="modal hidden">
      <div class="modal-content">
        <h2 id="customer-modal-title">Add Customer</h2>
        <form id="customer-form">
          <input type="hidden" name="id" />
          <div class="form-group"><label>Name *</label><input type="text" name="name" required /></div>
          <div class="form-group"><label>Address</label><textarea name="address" rows="2"></textarea></div>
          <div class="form-group"><label>GSTIN</label><input type="text" name="gstin" placeholder="22AAAAA0000A1Z5" /></div>
          <div class="form-group"><label>State</label><input type="text" name="state" /></div>
          <div class="form-group"><label>Phone</label><input type="tel" name="phone" /></div>
          <div class="form-actions">
            <button type="button" class="btn btn-outline modal-close">Cancel</button>
            <button type="submit" class="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const modal = $('#customer-modal', container);
  const form = $('#customer-form', container);

  $('#btn-add-customer', container).addEventListener('click', () => {
    $('#customer-modal-title', container).textContent = 'Add Customer';
    form.reset();
    form.querySelector('[name="id"]').value = '';
    modal.classList.remove('hidden');
  });

  container.querySelectorAll('.btn-edit-cust').forEach((btn) => {
    btn.addEventListener('click', () => {
      const c = customers.find((x) => x.id === btn.dataset.id);
      if (!c) return;
      $('#customer-modal-title', container).textContent = 'Edit Customer';
      form.querySelector('[name="id"]').value = c.id;
      form.querySelector('[name="name"]').value = c.name || '';
      form.querySelector('[name="address"]').value = c.address || '';
      form.querySelector('[name="gstin"]').value = c.gstin || '';
      form.querySelector('[name="state"]').value = c.state || '';
      form.querySelector('[name="phone"]').value = c.phone || '';
      modal.classList.remove('hidden');
    });
  });

  container.querySelectorAll('.btn-del-cust').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (confirm('Delete this customer?')) {
        D.deleteCustomer(btn.dataset.id);
        route();
      }
    });
  });

  modal.querySelectorAll('.modal-close').forEach((b) => {
    b.addEventListener('click', () => modal.classList.add('hidden'));
  });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = form.querySelector('[name="id"]').value;
    const data = {
      name: form.querySelector('[name="name"]').value.trim(),
      address: form.querySelector('[name="address"]').value.trim(),
      gstin: form.querySelector('[name="gstin"]').value.trim(),
      state: form.querySelector('[name="state"]').value.trim(),
      phone: form.querySelector('[name="phone"]').value.trim(),
    };
    if (id) D.updateCustomer(id, data);
    else D.addCustomer(data, currentId);
    modal.classList.add('hidden');
    route();
  });
}

// ---------- Products ----------
function renderProducts(container) {
  const currentId = D.getCurrentBusinessId();
  const products = D.getProducts(currentId);
  container.innerHTML = `
    <div class="page-header flex-between">
      <h1>Products</h1>
      <button type="button" class="btn btn-primary" id="btn-add-product">+ Add Product</button>
    </div>
    <div class="card">
      <table class="table">
        <thead><tr><th>Name</th><th>HSN</th><th>Rate</th><th>GST %</th><th>Unit</th><th></th></tr></thead>
        <tbody>
          ${products.map((p) => `
            <tr>
              <td>${p.name}</td>
              <td>${p.hsn || '-'}</td>
              <td>₹${(p.rate || 0).toLocaleString('en-IN')}</td>
              <td>${p.gstPercent || 0}%</td>
              <td>${p.unit || 'Pcs'}</td>
              <td><button class="btn-sm btn-edit-prod" data-id="${p.id}">Edit</button> <button class="btn-sm btn-del-prod" data-id="${p.id}">Delete</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div id="product-modal" class="modal hidden">
      <div class="modal-content">
        <h2 id="product-modal-title">Add Product</h2>
        <form id="product-form">
          <input type="hidden" name="id" />
          <div class="form-group"><label>Name *</label><input type="text" name="name" required /></div>
          <div class="form-group"><label>HSN Code</label><input type="text" name="hsn" placeholder="e.g. 8471" /></div>
          <div class="form-group"><label>Rate (₹) *</label><input type="number" name="rate" min="0" step="0.01" required /></div>
          <div class="form-group"><label>GST %</label><input type="number" name="gstPercent" min="0" max="100" step="0.01" value="18" /></div>
          <div class="form-group"><label>Unit</label><input type="text" name="unit" value="Pcs" /></div>
          <div class="form-actions">
            <button type="button" class="btn btn-outline modal-close">Cancel</button>
            <button type="submit" class="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const modal = $('#product-modal', container);
  const form = $('#product-form', container);

  $('#btn-add-product', container).addEventListener('click', () => {
    $('#product-modal-title', container).textContent = 'Add Product';
    form.reset();
    form.querySelector('[name="gstPercent"]').value = 18;
    form.querySelector('[name="unit"]').value = 'Pcs';
    form.querySelector('[name="id"]').value = '';
    modal.classList.remove('hidden');
  });

  container.querySelectorAll('.btn-edit-prod').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = products.find((x) => x.id === btn.dataset.id);
      if (!p) return;
      $('#product-modal-title', container).textContent = 'Edit Product';
      form.querySelector('[name="id"]').value = p.id;
      form.querySelector('[name="name"]').value = p.name || '';
      form.querySelector('[name="hsn"]').value = p.hsn || '';
      form.querySelector('[name="rate"]').value = p.rate || '';
      form.querySelector('[name="gstPercent"]').value = p.gstPercent ?? 18;
      form.querySelector('[name="unit"]').value = p.unit || 'Pcs';
      modal.classList.remove('hidden');
    });
  });

  container.querySelectorAll('.btn-del-prod').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (confirm('Delete this product?')) {
        D.deleteProduct(btn.dataset.id);
        route();
      }
    });
  });

  modal.querySelectorAll('.modal-close').forEach((b) => {
    b.addEventListener('click', () => modal.classList.add('hidden'));
  });
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = form.querySelector('[name="id"]').value;
    const data = {
      name: form.querySelector('[name="name"]').value.trim(),
      hsn: form.querySelector('[name="hsn"]').value.trim(),
      rate: parseFloat(form.querySelector('[name="rate"]').value) || 0,
      gstPercent: parseFloat(form.querySelector('[name="gstPercent"]').value) || 18,
      unit: form.querySelector('[name="unit"]').value.trim() || 'Pcs',
    };
    if (id) D.updateProduct(id, data);
    else D.addProduct(data, currentId);
    modal.classList.add('hidden');
    route();
  });
}

// ---------- Reports ----------
function renderReports(container) {
  const currentId = D.getCurrentBusinessId();
  const invoices = D.getInvoices(currentId);
  const byMonth = {};
  invoices.forEach((inv) => {
    const month = inv.date ? inv.date.slice(0, 7) : 'Unknown';
    if (!byMonth[month]) byMonth[month] = { count: 0, total: 0 };
    byMonth[month].count++;
    byMonth[month].total += inv.grandTotal || 0;
  });
  const months = Object.entries(byMonth).sort((a, b) => b[0].localeCompare(a[0]));

  container.innerHTML = `
    <div class="page-header">
      <h1>Reports</h1>
    </div>
    <div class="card">
      <h2>Sales Summary</h2>
      ${months.length === 0 ? '<p class="muted">No sales data yet.</p>' : `
      <table class="table">
        <thead><tr><th>Month</th><th>Invoices</th><th>Revenue (₹)</th></tr></thead>
        <tbody>
          ${months.map(([m, d]) => `<tr><td>${m}</td><td>${d.count}</td><td>₹${d.total.toLocaleString('en-IN')}</td></tr>`).join('')}
        </tbody>
      </table>
      `}
      <p class="muted" style="margin-top:16px;">Total Revenue: <strong>₹${invoices.reduce((s, i) => s + (i.grandTotal || 0), 0).toLocaleString('en-IN')}</strong></p>
    </div>
  `;
}

// ---------- Settings (Businesses + Invoice customization) ----------
function getVisibleColumns(business) {
  const settings = business && business.invoiceSettings ? business.invoiceSettings : D.defaultInvoiceSettings();
  const columns = (settings.columns || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const normalized = columns.map((c, i) => ({
    ...c,
    id: ALL_COLUMN_IDS.includes(c.id) ? c.id : (ALL_COLUMN_IDS[i] || ALL_COLUMN_IDS[0]),
  }));
  return normalized.filter((c) => c.visible !== false);
}

function renderSettings(container) {
  const businesses = D.getBusinesses();
  container.innerHTML = `
    <div class="page-header flex-between">
      <h1>Businesses &amp; Invoice Settings</h1>
      <button type="button" class="btn btn-primary" id="btn-add-business">+ Add Business</button>
    </div>
    <div class="card">
      <p class="muted" style="margin-bottom:16px;">Each business has its own profile and fully customizable invoice: choose which columns and fields to show and their labels. Settings are saved per business.</p>
      <table class="table">
        <thead><tr><th>Business</th><th>Address</th><th>Default</th><th></th></tr></thead>
        <tbody>
          ${businesses.map((b) => `
            <tr>
              <td><strong>${b.name}</strong></td>
              <td>${(b.address || '').slice(0, 40)}${(b.address && b.address.length > 40) ? '…' : ''}</td>
              <td>${b.isDefault ? '✓ Default' : ''}</td>
              <td>
                <button class="btn-sm btn-edit-business" data-id="${b.id}">Edit &amp; Customize</button>
                ${!b.isDefault ? `<button class="btn-sm btn-set-default" data-id="${b.id}">Set default</button>` : ''}
                ${businesses.length > 1 ? `<button class="btn-sm btn-del-business" data-id="${b.id}">Delete</button>` : ''}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <div class="card" style="margin-top:20px;">
      <h3 style="margin-top:0;">Where is my data stored?</h3>
      <p class="muted" style="margin-bottom:12px;">When you are <strong>signed in</strong>, data is stored in the cloud (Supabase) and is the same on every device. When you are not signed in, data is stored only in <strong>this browser</strong> (localStorage) and is not synced.</p>
      <p class="muted" style="margin-bottom:16px;">Use <strong>Export</strong> to download a backup file. Use <strong>Import</strong> to restore from a backup or move data to another device. Import replaces all current data.</p>
      <div class="flex-between" style="flex-wrap:wrap;gap:12px;">
        <button type="button" class="btn btn-outline" id="btn-export-data">Export backup (JSON)</button>
        <label class="btn btn-outline" style="margin:0;">
          Import backup
          <input type="file" id="input-import-data" accept=".json,application/json" style="display:none;" />
        </label>
      </div>
    </div>
    <div id="business-modal" class="modal hidden">
      <div class="modal-content modal-wide">
        <h2 id="business-modal-title">Add Business</h2>
        <div class="business-form-tabs">
          <button type="button" class="tab-btn active" data-tab="profile">Profile</button>
          <button type="button" class="tab-btn" data-tab="invoice">Customize Invoice</button>
          <button type="button" class="tab-btn" data-tab="print">Print Style</button>
        </div>
        <form id="business-form">
          <input type="hidden" name="id" />
          <div id="tab-profile" class="tab-pane">
            <div class="form-group"><label>Business Name *</label><input type="text" name="name" required /></div>
            <div class="form-group"><label>Address</label><textarea name="address" rows="3"></textarea></div>
            <div class="form-group"><label>GSTIN</label><input type="text" name="gstin" placeholder="22AAAAA0000A1Z5" /></div>
            <div class="form-group"><label>State</label><input type="text" name="state" /></div>
            <div class="form-group"><label>Phone</label><input type="tel" name="phone" /></div>
            <div class="form-group"><label>Tagline (e.g. Best service guaranteed)</label><input type="text" name="tagline" placeholder="One line shown below business name on invoice" /></div>
            <h4 style="margin-top:20px;">Bank details (optional, for print)</h4>
            <div class="form-group"><label>Bank name</label><input type="text" name="bankName" placeholder="HDFC Bank" /></div>
            <div class="form-row two-cols">
              <div class="form-group"><label>Account number</label><input type="text" name="bankAccountNo" placeholder="1234567890" /></div>
              <div class="form-group"><label>IFSC</label><input type="text" name="bankIfsc" placeholder="HDFC0001234" /></div>
            </div>
            <div class="form-group"><label>UPI ID (for payment)</label><input type="text" name="upiId" placeholder="yourname@upi" /></div>
            <h4 style="margin-top:20px;">Invoice number sequence</h4>
            <div class="form-row two-cols">
              <div class="form-group"><label>Prefix (e.g. INV, MB)</label><input type="text" name="invoiceNumberPrefix" placeholder="INV" /></div>
              <div class="form-group"><label>Next number</label><input type="number" name="invoiceNumberNext" min="1" placeholder="1" /></div>
            </div>
            <div class="form-group">
              <label class="checkbox-label"><input type="checkbox" name="invoiceNumberIncludeYear" checked /> Include year in invoice number (e.g. INV-2025-0001)</label>
            </div>
            <h4 style="margin-top:20px;">Logo</h4>
            <div class="form-group">
              <div id="business-logo-preview" class="logo-preview"></div>
              <input type="file" id="business-logo-input" accept="image/*" />
              <button type="button" class="btn btn-outline btn-sm" id="business-logo-remove" style="margin-top:8px;display:none;">Remove logo</button>
            </div>
          </div>
          <div id="tab-invoice" class="tab-pane hidden">
            <p class="muted" style="margin-bottom:16px;">Customize what appears on your invoice. Toggle sections and choose column names.</p>
            <div class="customize-section card" style="padding:16px; margin-bottom:16px; border-left:4px solid var(--primary);">
              <h4 style="margin:0 0 12px 0;">What to show on invoice</h4>
              <label class="checkbox-label" style="display:block;margin-bottom:8px;"><input type="checkbox" name="showTagline" data-inv-setting /> Show tagline (set in Profile)</label>
              <label class="checkbox-label" style="display:block;margin-bottom:8px;"><input type="checkbox" name="showBankDetails" data-inv-setting /> Show bank details (set in Profile)</label>
              <label class="checkbox-label" style="display:block;"><input type="checkbox" name="showAmountInWords" data-inv-setting checked /> Show amount in words</label>
            </div>
            <div class="customize-section card" style="padding:16px; margin-bottom:16px; border-left:4px solid var(--primary);">
              <h4 style="margin:0 0 8px 0;">Item table columns</h4>
              <p class="muted" style="font-size:0.8125rem; margin-bottom:12px;">Choose which columns appear and their display name (e.g. "Qty" → "No of days"). You can add Batch, Exp Date, Mfg Date.</p>
              <div id="invoice-columns-list" class="customize-list"></div>
            </div>
            <div class="customize-section card" style="padding:16px; margin-bottom:16px; border-left:4px solid var(--primary);">
              <h4 style="margin:0 0 8px 0;">Header fields (top of invoice)</h4>
              <div id="invoice-headers-list" class="customize-list"></div>
            </div>
            <div class="customize-section card" style="padding:16px; margin-bottom:16px; border-left:4px solid var(--primary);">
              <h4 style="margin:0 0 8px 0;">Summary rows (totals section)</h4>
              <div id="invoice-summary-list" class="customize-list"></div>
            </div>
          </div>
          <div id="tab-print" class="tab-pane hidden">
            <p class="muted" style="margin-bottom:16px;">Customize how the invoice looks when you print or save as PDF. These options apply only to the printed view.</p>
            <div class="form-group">
              <label>Invoice Theme</label>
              <select name="printTemplate">
                <option value="modern">Modern (Clean & spacious, rounded elements)</option>
                <option value="creative">Creative (Airy, pastel blocks, rounded headers)</option>
                <option value="elegant">Elegant (Classic serif, minimalist lines, centered)</option>
                <option value="bold">Bold (Thick side border, high contrast headers)</option>
                <option value="standard">Standard (Classic business grid look)</option>
                <option value="smart">Smart (Compact & sleek, split layout)</option>
                <option value="advance">Advance (Bold colored header banner)</option>
                <option value="curves">Curves (Swooping color accents top and bottom)</option>
                <option value="stripes">Stripes (Minimalist with alternating row colors)</option>
                <option value="block">Block (Solid color header block for company info)</option>
              </select>
              <div id="theme-preview-box" class="theme-preview"></div>
            </div>
            <h4 style="margin-top:20px;">Layout & Placement</h4>
            <div class="form-row two-cols">
              <div class="form-group">
                <label>Header Layout</label>
                <select name="printHeaderLayout">
                  <option value="standard">Standard (Company Left, Title Right)</option>
                  <option value="flipped">Flipped (Title Left, Company Right)</option>
                  <option value="centered">Centered (Everything Centered)</option>
                </select>
              </div>
              <div class="form-group">
                <label>Logo Alignment</label>
                <select name="printLogoPosition">
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>
            <div class="form-row two-cols">
              <div class="form-group">
                <label class="checkbox-label" style="margin-top:8px;"><input type="checkbox" name="printWatermark" /> Show Logo as Background Watermark</label>
              </div>
              <div class="form-group">
                <label>Signature Label</label>
                <input type="text" name="printSignatureLabel" placeholder="e.g. Authorized Signatory" />
              </div>
            </div>
            <h4 style="margin-top:20px;">Style Setup</h4>
            <div class="form-group">
              <label>Invoice title (printed header)</label>
              <input type="text" name="printTitle" placeholder="TAX INVOICE" />
            </div>
            <div class="form-row two-cols">
              <div class="form-group">
                <label>Accent color (header &amp; borders)</label>
                <input type="text" name="printPrimaryColor" placeholder="#0d9488" />
              </div>
              <div class="form-group">
                <label>Logo max height (px)</label>
                <input type="number" name="printLogoMaxHeight" min="24" max="120" placeholder="56" />
              </div>
            </div>
            <div class="form-group">
              <label>Font family</label>
              <select name="printFont">
                <option value="system-ui, Arial, sans-serif">System / Arial</option>
                <option value="Georgia, serif">Georgia</option>
                <option value="'Segoe UI', system-ui, sans-serif">Segoe UI</option>
                <option value="'Times New Roman', Times, serif">Times New Roman</option>
              </select>
            </div>
            <div class="form-group">
              <label>Table style</label>
              <select name="printTableStyle">
                <option value="bordered">Bordered (grid)</option>
                <option value="minimal">Minimal (clean lines)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Thank you / footer message</label>
              <input type="text" name="printThankYouText" placeholder="Thank you for your business." />
              <span class="muted" style="font-size:0.8125rem;">Leave empty to hide.</span>
            </div>
          </div>
          <div class="form-actions" style="margin-top:20px;">
            <button type="button" class="btn btn-outline modal-close">Cancel</button>
            <button type="submit" class="btn btn-primary">Save Business</button>
          </div>
        </form>
      </div>
    </div>
  `;

  const modal = $('#business-modal', container);
  const form = $('#business-form', container);
  let pendingLogoData = null;
  let logoRemoved = false;

  function openModal(business) {
    logoRemoved = false;
    $('#business-modal-title', container).textContent = business ? 'Edit Business' : 'Add Business';
    form.querySelector('[name="id"]').value = business ? business.id : '';
    form.querySelector('[name="name"]').value = business ? business.name : '';
    form.querySelector('[name="address"]').value = business ? business.address || '' : '';
    form.querySelector('[name="gstin"]').value = business ? business.gstin || '' : '';
    form.querySelector('[name="state"]').value = business ? business.state || '' : '';
    form.querySelector('[name="phone"]').value = business ? business.phone || '' : '';
    form.querySelector('[name="tagline"]').value = business ? (business.tagline || '') : '';
    form.querySelector('[name="bankName"]').value = business ? (business.bankName || '') : '';
    form.querySelector('[name="bankAccountNo"]').value = business ? (business.bankAccountNo || '') : '';
    form.querySelector('[name="bankIfsc"]').value = business ? (business.bankIfsc || '') : '';
    form.querySelector('[name="upiId"]').value = business ? (business.upiId || '') : '';
    form.querySelector('[name="invoiceNumberPrefix"]').value = business ? (business.invoiceNumberPrefix || 'INV') : 'INV';
    form.querySelector('[name="invoiceNumberNext"]').value = business ? (business.invoiceNumberNext != null ? business.invoiceNumberNext : 1) : 1;
    form.querySelector('[name="invoiceNumberIncludeYear"]').checked = business ? (business.invoiceNumberIncludeYear !== false) : true;
    pendingLogoData = business && business.logo ? business.logo : null;
    const logoPreview = $('#business-logo-preview', container);
    const logoRemove = $('#business-logo-remove', container);
    if (logoPreview) {
      if (pendingLogoData) {
        logoPreview.innerHTML = `<img src="${pendingLogoData}" alt="Logo" class="logo-preview-img" />`;
        if (logoRemove) logoRemove.style.display = 'inline-block';
      } else {
        logoPreview.innerHTML = '<span class="muted">No logo</span>';
        if (logoRemove) logoRemove.style.display = 'none';
      }
    }
    $('#business-logo-input', container).value = '';
    if (business && business.invoiceSettings) {
      renderCustomizeLists(business.invoiceSettings);
      const s = business.invoiceSettings;
      const def = D.defaultInvoiceSettings();
      form.querySelector('[name="printTitle"]').value = s.printTitle != null ? s.printTitle : (def.printTitle || 'TAX INVOICE');
      form.querySelector('[name="printPrimaryColor"]').value = s.printPrimaryColor || def.printPrimaryColor || '#0d9488';
      form.querySelector('[name="printLogoMaxHeight"]').value = s.printLogoMaxHeight != null ? s.printLogoMaxHeight : (def.printLogoMaxHeight || 56);
      form.querySelector('[name="printFont"]').value = s.printFont || def.printFont || 'system-ui, Arial, sans-serif';
      form.querySelector('[name="printTableStyle"]').value = s.printTableStyle || def.printTableStyle || 'bordered';
      form.querySelector('[name="printThankYouText"]').value = s.printThankYouText != null ? s.printThankYouText : (def.printThankYouText || '');
      form.querySelector('[name="printTemplate"]').value = s.printTemplate || def.printTemplate || 'modern';
      form.querySelector('[name="printHeaderLayout"]').value = s.printHeaderLayout || def.printHeaderLayout || 'standard';
      form.querySelector('[name="printLogoPosition"]').value = s.printLogoPosition || def.printLogoPosition || 'left';
      form.querySelector('[name="printWatermark"]').checked = s.printWatermark === true;
      form.querySelector('[name="printSignatureLabel"]').value = s.printSignatureLabel || def.printSignatureLabel || '';
      form.querySelector('[name="showTagline"]').checked = s.showTagline === true;
      form.querySelector('[name="showBankDetails"]').checked = s.showBankDetails === true;
      form.querySelector('[name="showAmountInWords"]').checked = s.showAmountInWords !== false;
    } else {
      renderCustomizeLists(D.defaultInvoiceSettings());
      const def = D.defaultInvoiceSettings();
      form.querySelector('[name="showTagline"]').checked = def.showTagline === true;
      form.querySelector('[name="showBankDetails"]').checked = def.showBankDetails === true;
      form.querySelector('[name="showAmountInWords"]').checked = def.showAmountInWords !== false;
      form.querySelector('[name="printTitle"]').value = def.printTitle || 'TAX INVOICE';
      form.querySelector('[name="printPrimaryColor"]').value = def.printPrimaryColor || '#0d9488';
      form.querySelector('[name="printLogoMaxHeight"]').value = def.printLogoMaxHeight || 56;
      form.querySelector('[name="printFont"]').value = def.printFont || 'system-ui, Arial, sans-serif';
      form.querySelector('[name="printTableStyle"]').value = def.printTableStyle || 'bordered';
      form.querySelector('[name="printThankYouText"]').value = def.printThankYouText || '';
      form.querySelector('[name="printTemplate"]').value = def.printTemplate || 'modern';
      form.querySelector('[name="printHeaderLayout"]').value = def.printHeaderLayout || 'standard';
      form.querySelector('[name="printLogoPosition"]').value = def.printLogoPosition || 'left';
      form.querySelector('[name="printWatermark"]').checked = def.printWatermark === true;
      form.querySelector('[name="printSignatureLabel"]').value = def.printSignatureLabel || '';
    }
    updateThemePreview();
    modal.classList.remove('hidden');
  }

  function updateThemePreview() {
    const previewBox = document.getElementById('theme-preview-box');
    if (!previewBox) return;
    const theme = form.querySelector('[name="printTemplate"]').value || 'modern';
    const accent = form.querySelector('[name="printPrimaryColor"]').value || '#4f46e5';
    let html = '';
    if (theme === 'advance') {
      html = `
        <div class="tp-advance" style="--tp-color: ${accent}">
          <div class="tp-header">
             <div class="tp-logo"></div>
             <div class="tp-title"></div>
          </div>
          <div class="tp-content">
             <div class="tp-lines"></div>
             <div class="tp-lines" style="width: 60%"></div>
             <div class="tp-table">
               <div class="tp-th"></div>
               <div class="tp-td"></div>
               <div class="tp-td"></div>
               <div class="tp-td"></div>
             </div>
             <div class="tp-summary"></div>
          </div>
        </div>
      `;
    } else if (theme === 'smart') {
      html = `
        <div class="tp-smart" style="--tp-color: ${accent}">
          <div class="tp-header">
             <div class="tp-left">
               <div class="tp-logo"></div>
               <div class="tp-lines"></div>
             </div>
             <div class="tp-right">
               <div class="tp-title"></div>
               <div class="tp-meta"></div>
             </div>
          </div>
          <div class="tp-boxes">
            <div class="tp-box"></div>
            <div class="tp-box"></div>
          </div>
          <div class="tp-table">
            <div class="tp-th"></div>
            <div class="tp-td"></div>
            <div class="tp-td"></div>
          </div>
          <div class="tp-summary"></div>
        </div>
      `;
    } else if (theme === 'creative') {
      html = `
        <div class="tp-creative" style="--tp-color: ${accent}">
          <div class="tp-header">
             <div class="tp-logo"></div>
             <div class="tp-title"></div>
          </div>
          <div class="tp-boxes">
            <div class="tp-box"></div>
            <div class="tp-box"></div>
          </div>
          <div class="tp-table">
            <div class="tp-th"></div>
            <div class="tp-td"></div>
            <div class="tp-td"></div>
          </div>
          <div class="tp-summary"></div>
        </div>
      `;
    } else if (theme === 'elegant') {
      html = `
        <div class="tp-elegant" style="--tp-color: ${accent}">
          <div class="tp-header">
             <div class="tp-logo"></div>
             <div class="tp-title"></div>
          </div>
          <div class="tp-lines" style="margin: 0 auto;"></div>
          <div class="tp-table">
            <div class="tp-th"></div>
            <div class="tp-td"></div>
            <div class="tp-td"></div>
          </div>
          <div class="tp-summary"></div>
        </div>
      `;
    } else if (theme === 'bold') {
      html = `
        <div class="tp-bold" style="--tp-color: ${accent}">
          <div class="tp-sidebar"></div>
          <div class="tp-content">
            <div class="tp-header">
               <div class="tp-title"></div>
               <div class="tp-logo"></div>
            </div>
            <div class="tp-box"></div>
            <div class="tp-table">
              <div class="tp-th"></div>
              <div class="tp-td"></div>
              <div class="tp-td"></div>
            </div>
            <div class="tp-summary"></div>
          </div>
        </div>
      `;
    } else if (theme === 'standard') {
      html = `
        <div class="tp-standard" style="--tp-color: ${accent}">
          <div class="tp-header">
             <div class="tp-logo"></div>
             <div class="tp-title"></div>
          </div>
          <div class="tp-boxes">
            <div class="tp-box"></div>
            <div class="tp-box"></div>
          </div>
          <div class="tp-table">
            <div class="tp-th"></div>
            <div class="tp-td"></div>
            <div class="tp-td"></div>
          </div>
          <div class="tp-summary"></div>
        </div>
      `;
    } else if (theme === 'curves') {
      html = `
        <div class="tp-curves" style="--tp-color: ${accent}">
          <div class="tp-swoosh-top"></div>
          <div class="tp-swoosh-bot"></div>
          <div class="tp-header">
             <div class="tp-logo"></div>
             <div class="tp-title"></div>
          </div>
          <div class="tp-boxes" style="position:relative;z-index:1;">
            <div class="tp-box"></div>
          </div>
          <div class="tp-table" style="position:relative;z-index:1;">
            <div class="tp-th"></div>
            <div class="tp-td"></div>
            <div class="tp-td"></div>
          </div>
          <div class="tp-summary" style="position:relative;z-index:1;"></div>
        </div>
      `;
    } else if (theme === 'stripes') {
      html = `
        <div class="tp-stripes" style="--tp-color: ${accent}">
          <div class="tp-header">
             <div class="tp-logo"></div>
             <div class="tp-title"></div>
          </div>
          <div class="tp-table">
            <div class="tp-th"></div>
            <div class="tp-row"><div class="tp-td"></div></div>
            <div class="tp-row"><div class="tp-td"></div></div>
            <div class="tp-row"><div class="tp-td"></div></div>
          </div>
          <div class="tp-summary"></div>
        </div>
      `;
    } else if (theme === 'block') {
      html = `
        <div class="tp-block" style="--tp-color: ${accent}">
          <div class="tp-header">
             <div class="tp-left">
               <div class="tp-logo"></div>
               <div class="tp-line" style="width:40px;height:4px;margin-top:4px;"></div>
             </div>
             <div class="tp-right">
               <div class="tp-title"></div>
             </div>
          </div>
          <div class="tp-table">
            <div class="tp-th"></div>
            <div class="tp-td"></div>
            <div class="tp-td"></div>
          </div>
          <div class="tp-summary"></div>
        </div>
      `;
    } else {
      // modern
      html = `
        <div class="tp-modern" style="--tp-color: ${accent}">
          <div class="tp-header">
             <div class="tp-left">
               <div class="tp-logo"></div>
               <div class="tp-lines"></div>
             </div>
             <div class="tp-right">
               <div class="tp-title"></div>
               <div class="tp-meta"></div>
             </div>
          </div>
          <div class="tp-billto"></div>
          <div class="tp-table">
            <div class="tp-th"></div>
            <div class="tp-td"></div>
            <div class="tp-td"></div>
          </div>
          <div class="tp-summary"></div>
        </div>
      `;
    }
    previewBox.innerHTML = html;
  }

  const themeSelect = form.querySelector('[name="printTemplate"]');
  const colorInput = form.querySelector('[name="printPrimaryColor"]');
  if (themeSelect) themeSelect.addEventListener('change', updateThemePreview);
  if (colorInput) colorInput.addEventListener('input', updateThemePreview);

  function getInvSettingCheckbox(name) {
    const el = form.querySelector('[name="' + name + '"]');
    return el ? el.checked : false;
  }

  const logoInput = container.querySelector('#business-logo-input');
  if (logoInput) {
    logoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file || !file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        pendingLogoData = reader.result;
        const logoPreview = $('#business-logo-preview', container);
        const logoRemove = $('#business-logo-remove', container);
        if (logoPreview) logoPreview.innerHTML = `<img src="${pendingLogoData}" alt="Logo" class="logo-preview-img" />`;
        if (logoRemove) logoRemove.style.display = 'inline-block';
      };
      reader.readAsDataURL(file);
    });
  }
  const logoRemoveBtn = container.querySelector('#business-logo-remove');
  if (logoRemoveBtn) {
    logoRemoveBtn.addEventListener('click', () => {
      pendingLogoData = null;
      logoRemoved = true;
      const logoPreview = $('#business-logo-preview', container);
      if (logoPreview) logoPreview.innerHTML = '<span class="muted">No logo</span>';
      logoRemoveBtn.style.display = 'none';
      $('#business-logo-input', container).value = '';
    });
  }

  function renderCustomizeLists(settings) {
    const defCols = D.defaultInvoiceSettings().columns;
    let cols = (settings.columns || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    cols = cols.length ? cols : defCols.slice();
    cols.forEach((c, i) => {
      if (!ALL_COLUMN_IDS.includes(c.id)) c.id = ALL_COLUMN_IDS[i] || 'qty';
    });
    ALL_COLUMN_IDS.forEach((id, idx) => {
      if (!cols.some((c) => c.id === id)) cols.push({ id, label: COLUMN_FIELD_LABELS[id] || id, visible: false, order: 100 + idx });
    });
    cols.sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    const headers = settings.headerFields || [];
    const summary = settings.summaryRows || [];
    $('#invoice-columns-list', container).innerHTML = cols.map((c, i) => {
      const fieldName = COLUMN_FIELD_LABELS[c.id] || c.id;
      return `
      <div class="customize-row" data-id="${c.id}">
        <label class="customize-check"><input type="checkbox" ${c.visible !== false ? 'checked' : ''} data-visible /> Show</label>
        <span class="customize-field-name" title="Field type (used for calculations)">${fieldName}</span>
        <input type="text" class="customize-label" value="${(c.label || fieldName).replace(/"/g, '&quot;')}" data-label placeholder="Display name on invoice" title="Custom name (e.g. No of days). Calculations unchanged." />
        <span class="customize-order">
          <button type="button" class="btn-order" data-dir="-1" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" class="btn-order" data-dir="1" ${i === cols.length - 1 ? 'disabled' : ''}>↓</button>
        </span>
      </div>`;
    }).join('');
    $('#invoice-headers-list', container).innerHTML = headers.map((h) => `
      <div class="customize-row" data-id="${h.id}">
        <label class="customize-check"><input type="checkbox" ${h.visible !== false ? 'checked' : ''} data-visible /> Show</label>
        <input type="text" class="customize-label" value="${(h.label || '').replace(/"/g, '&quot;')}" data-label placeholder="Label" />
      </div>`).join('');
    $('#invoice-summary-list', container).innerHTML = summary.map((s) => `
      <div class="customize-row" data-id="${s.id}">
        <label class="customize-check"><input type="checkbox" ${s.visible !== false ? 'checked' : ''} data-visible /> Show</label>
        <input type="text" class="customize-label" value="${(s.label || '').replace(/"/g, '&quot;')}" data-label placeholder="Label" />
      </div>`).join('');

    // Order buttons for columns
    $('#invoice-columns-list', container).querySelectorAll('.btn-order').forEach((btn) => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.customize-row');
        const list = Array.from($('#invoice-columns-list', container).children);
        const idx = list.indexOf(row);
        const dir = parseInt(btn.dataset.dir, 10);
        const newIdx = idx + dir;
        if (newIdx < 0 || newIdx >= list.length) return;
        const parent = row.parentNode;
        if (dir < 0) parent.insertBefore(row, list[newIdx]);
        else parent.insertBefore(list[newIdx], row);
        // Re-enable/disable order buttons
        list.forEach((r, i) => {
          const up = r.querySelector('[data-dir="-1"]');
          const down = r.querySelector('[data-dir="1"]');
          if (up) up.disabled = i === 0;
          if (down) down.disabled = i === list.length - 1;
        });
      });
    });
  }

  function collectInvoiceSettings() {
    const columns = [];
    $('#invoice-columns-list', container).querySelectorAll('.customize-row').forEach((row, i) => {
      let id = row.dataset.id;
      if (!ALL_COLUMN_IDS.includes(id)) id = ALL_COLUMN_IDS[i] || 'qty';
      const labelVal = row.querySelector('[data-label]').value.trim();
      columns.push({
        id,
        visible: row.querySelector('[data-visible]').checked,
        label: labelVal || COLUMN_FIELD_LABELS[id] || id,
        order: i,
      });
    });
    const headerFields = [];
    $('#invoice-headers-list', container).querySelectorAll('.customize-row').forEach((row) => {
      headerFields.push({
        id: row.dataset.id,
        visible: row.querySelector('[data-visible]').checked,
        label: row.querySelector('[data-label]').value.trim() || row.dataset.id,
      });
    });
    const summaryRows = [];
    $('#invoice-summary-list', container).querySelectorAll('.customize-row').forEach((row) => {
      summaryRows.push({
        id: row.dataset.id,
        visible: row.querySelector('[data-visible]').checked,
        label: row.querySelector('[data-label]').value.trim() || row.dataset.id,
      });
    });
    const printTitleEl = form.querySelector('[name="printTitle"]');
    const printColorEl = form.querySelector('[name="printPrimaryColor"]');
    const printLogoEl = form.querySelector('[name="printLogoMaxHeight"]');
    const printFontEl = form.querySelector('[name="printFont"]');
    const printTableEl = form.querySelector('[name="printTableStyle"]');
    const printThankEl = form.querySelector('[name="printThankYouText"]');
    const printTemplateEl = form.querySelector('[name="printTemplate"]');
    const headerLayoutEl = form.querySelector('[name="printHeaderLayout"]');
    const logoPositionEl = form.querySelector('[name="printLogoPosition"]');
    const signatureLabelEl = form.querySelector('[name="printSignatureLabel"]');
    return {
      columns,
      headerFields,
      summaryRows,
      showTagline: getInvSettingCheckbox('showTagline'),
      showBankDetails: getInvSettingCheckbox('showBankDetails'),
      showAmountInWords: getInvSettingCheckbox('showAmountInWords'),
      printWatermark: getInvSettingCheckbox('printWatermark'),
      printTitle: printTitleEl ? printTitleEl.value.trim() || 'TAX INVOICE' : undefined,
      printPrimaryColor: printColorEl ? (printColorEl.value.trim() || '#0d9488') : undefined,
      printLogoMaxHeight: printLogoEl ? (parseInt(printLogoEl.value, 10) || 56) : undefined,
      printFont: printFontEl ? printFontEl.value : undefined,
      printTableStyle: printTableEl ? printTableEl.value : undefined,
      printThankYouText: printThankEl ? printThankEl.value.trim() : undefined,
      printTemplate: printTemplateEl ? printTemplateEl.value : 'modern',
      printHeaderLayout: headerLayoutEl ? headerLayoutEl.value : 'standard',
      printLogoPosition: logoPositionEl ? logoPositionEl.value : 'left',
      printSignatureLabel: signatureLabelEl ? signatureLabelEl.value.trim() : '',
    };
  }

  $('#btn-add-business', container).addEventListener('click', () => openModal(null));

  const exportBtn = $('#btn-export-data', container);
  if (exportBtn) {
    exportBtn.addEventListener('click', () => {
      const data = D.exportAllData();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `billing-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    });
  }
  const importInput = $('#input-import-data', container);
  if (importInput) {
    importInput.addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const data = JSON.parse(reader.result);
          if (!D.importAllData(data)) {
            alert('Invalid backup file.');
            e.target.value = '';
            return;
          }
          alert('Backup restored. Reloading…');
          e.target.value = '';
          renderBusinessSwitcher();
          route();
        } catch (err) {
          alert('Could not read file: ' + (err.message || 'Invalid JSON'));
          e.target.value = '';
        }
      };
      reader.readAsText(file);
    });
  }

  container.querySelectorAll('.btn-edit-business').forEach((btn) => {
    btn.addEventListener('click', () => {
      const b = D.getBusinessById(btn.dataset.id);
      if (b) openModal(b);
    });
  });

  container.querySelectorAll('.btn-set-default').forEach((btn) => {
    btn.addEventListener('click', () => {
      D.setDefaultBusiness(btn.dataset.id);
      route();
    });
  });

  container.querySelectorAll('.btn-del-business').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (confirm('Delete this business? Invoices linked to it will keep the last saved data.')) {
        D.deleteBusiness(btn.dataset.id);
        route();
      }
    });
  });

  container.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      container.querySelectorAll('.tab-pane').forEach((p) => p.classList.add('hidden'));
      btn.classList.add('active');
      $('#tab-' + btn.dataset.tab, container).classList.remove('hidden');
    });
  });

  modal.querySelectorAll('.modal-close').forEach((b) => b.addEventListener('click', () => modal.classList.add('hidden')));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.add('hidden'); });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const id = form.querySelector('[name="id"]').value;
    const payload = {
      name: form.querySelector('[name="name"]').value.trim(),
      address: form.querySelector('[name="address"]').value.trim(),
      gstin: form.querySelector('[name="gstin"]').value.trim(),
      state: form.querySelector('[name="state"]').value.trim(),
      phone: form.querySelector('[name="phone"]').value.trim(),
      tagline: form.querySelector('[name="tagline"]').value.trim(),
      bankName: form.querySelector('[name="bankName"]').value.trim(),
      bankAccountNo: form.querySelector('[name="bankAccountNo"]').value.trim(),
      bankIfsc: form.querySelector('[name="bankIfsc"]').value.trim(),
      upiId: form.querySelector('[name="upiId"]').value.trim(),
      invoiceNumberPrefix: form.querySelector('[name="invoiceNumberPrefix"]').value.trim() || 'INV',
      invoiceNumberNext: Math.max(1, parseInt(form.querySelector('[name="invoiceNumberNext"]').value, 10) || 1),
      invoiceNumberIncludeYear: form.querySelector('[name="invoiceNumberIncludeYear"]').checked,
      logo: logoRemoved ? null : (pendingLogoData !== undefined && pendingLogoData !== null ? pendingLogoData : (id ? D.getBusinessById(id).logo : null)),
      invoiceSettings: collectInvoiceSettings(),
    };
    if (id) D.updateBusiness(id, payload);
    else D.addBusiness(payload);
    modal.classList.add('hidden');
    renderBusinessSwitcher();
    route();
  });
}

// ---------- Auth (cloud sync) ----------
function renderAuthState() {
  const el = document.getElementById('sidebar-auth');
  if (!el) return;
  const Cloud = window.BillingCloud;
  if (!Cloud || !Cloud.isConfigured()) {
    el.innerHTML = '';
    return;
  }
  Cloud.getSession().then((session) => {
    if (session && session.user) {
      el.innerHTML = `
        <div class="auth-user" title="Synced across devices">${session.user.email || 'Signed in'}</div>
        <button type="button" class="btn-auth" id="btn-sign-out">Sign out</button>
      `;
      const btn = document.getElementById('btn-sign-out');
      if (btn) btn.addEventListener('click', () => handleSignOut());
    } else {
      el.innerHTML = '<button type="button" class="btn-auth" id="btn-sign-in">Sign in to sync across devices</button>';
      const btn = document.getElementById('btn-sign-in');
      if (btn) btn.addEventListener('click', () => openAuthModal());
    }
  }).catch(() => {
    el.innerHTML = '<button type="button" class="btn-auth" id="btn-sign-in">Sign in to sync across devices</button>';
    const btn = document.getElementById('btn-sign-in');
    if (btn) btn.addEventListener('click', () => openAuthModal());
  });
}

function openAuthModal() {
  const modal = document.getElementById('auth-modal');
  const errEl = document.getElementById('auth-error');
  if (modal) modal.classList.remove('hidden');
  if (errEl) { errEl.classList.add('hidden'); errEl.textContent = ''; }
}

function closeAuthModal() {
  const modal = document.getElementById('auth-modal');
  if (modal) modal.classList.add('hidden');
}

function handleSignOut() {
  const Cloud = window.BillingCloud;
  if (!Cloud) return;
  Cloud.signOut().then(() => {
    D.clearCloudCache();
    renderAuthState();
    renderBusinessSwitcher();
    route();
  });
}

function setupAuthForm() {
  const form = document.getElementById('auth-form');
  const modal = document.getElementById('auth-modal');
  const errEl = document.getElementById('auth-error');
  if (!form || !modal) return;
  modal.querySelectorAll('.modal-close').forEach((b) => b.addEventListener('click', closeAuthModal));
  modal.addEventListener('click', (e) => { if (e.target === modal) closeAuthModal(); });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = (document.getElementById('auth-email') || {}).value || '';
    const password = (document.getElementById('auth-password') || {}).value || '';
    const action = (e.submitter && e.submitter.getAttribute('value')) || 'signin';
    if (!email || !password) return;
    if (errEl) { errEl.classList.add('hidden'); errEl.textContent = ''; errEl.style.color = ''; }
    const Cloud = window.BillingCloud;
    if (!Cloud) return;
    const promise = action === 'signup' ? Cloud.signUp(email, password) : Cloud.signIn(email, password);
    promise.then(({ data, error }) => {
      if (error) {
        if (errEl) { errEl.textContent = error.message || 'Sign in failed'; errEl.classList.remove('hidden'); }
        return;
      }
      if (action === 'signup' && data && data.user && !data.session) {
        if (errEl) { 
          errEl.textContent = 'Account created! Please check your email to confirm your account, or disable "Confirm email" in Supabase to sign in directly.'; 
          errEl.style.color = '#0d9488'; // success color
          errEl.classList.remove('hidden'); 
        }
        return;
      }
      closeAuthModal();
      return D.dataReady().then(() => {
        renderAuthState();
        renderBusinessSwitcher();
        route();
      });
    });
  });
}

// ---------- Init ----------
function init() {
  window.addEventListener('hashchange', () => {
    route();
    setActiveNav((window.location.hash || '#dashboard').split('/')[0].slice(1));
    renderBusinessSwitcher();
  });

  const main = document.getElementById('main');
  if (main) main.innerHTML = '<div class="card" style="padding:40px;text-align:center;color:var(--text-muted);">Loading…</div>';

  const Cloud = window.BillingCloud;
  const hasCloud = Cloud && Cloud.isConfigured();
  const ready = hasCloud ? D.dataReady() : Promise.resolve();
  ready.then(() => {
    try {
      setupAuthForm();
      renderAuthState();
      renderBusinessSwitcher();
      route();
      setActiveNav((window.location.hash || '#dashboard').slice(1).split('/')[0]);
    } catch (err) {
      console.error('Init failed', err);
      if (main) main.innerHTML = '<div class="card" style="padding:24px;"><p>Something went wrong. Try refreshing. If you use cloud sync, check the browser console and your Supabase project.</p></div>';
    }
  }).catch((err) => {
    console.error('Init failed', err);
    try {
      if (main) main.innerHTML = '';
      renderBusinessSwitcher();
      route();
      setActiveNav((window.location.hash || '#dashboard').slice(1).split('/')[0]);
    } catch (e) {
      if (main) main.innerHTML = '<div class="card" style="padding:24px;"><p>Could not load the app. Check the console for errors.</p></div>';
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
