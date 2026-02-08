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
const ALL_COLUMN_IDS = ['sr', 'particulars', 'hsn', 'unit', 'qty', 'rate', 'discount', 'taxable', 'cgst', 'sgst', 'igst', 'amount'];
// Field type labels (used for calculations); display label is customizable per business.
const COLUMN_FIELD_LABELS = { sr: 'S.No', particulars: 'Particulars', hsn: 'HSN', unit: 'Unit', qty: 'Qty', rate: 'Rate', discount: 'Discount', taxable: 'Taxable Value', cgst: 'CGST', sgst: 'SGST', igst: 'IGST', amount: 'Amount' };

function buildOneInvoiceRow(visibleColumns, products, row, idx) {
  const prodsOpts = products.map((p) => `<option value="${p.id}" data-name="${p.name}" data-hsn="${p.hsn}" data-rate="${p.rate}" data-gst="${p.gstPercent}" data-unit="${p.unit || 'Pcs'}" ${row.productId === p.id ? 'selected' : ''}>${p.name} - ₹${p.rate}</option>`).join('');
  const hiddenGst = `<td class="col-gst-hidden" style="display:none;padding:0;border:0"><input type="hidden" class="item-gst" value="${row.gstPercent ?? 18}" /></td>`;
  const cells = visibleColumns.map((c) => {
    const id = c.id;
    if (id === 'sr') return `<td class="col-sr">${idx + 1}</td>`;
    if (id === 'particulars') return `<td class="col-particulars"><select class="item-product">${prodsOpts ? '<option value="">Select</option>' + prodsOpts : '<option value="">No products</option>'}</select></td>`;
    if (id === 'hsn') return `<td class="col-hsn"><input type="text" class="item-hsn" readonly value="${row.hsn || ''}" /></td>`;
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
      items.push({
        productId,
        productName,
        hsn: $('.item-hsn', row)?.value || '',
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
      const right = ['taxable', 'rate', 'discount', 'cgst', 'sgst', 'igst', 'amount'].indexOf(c.id) >= 0;
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

  const logoImg = business && business.logo ? `<img src="${business.logo}" alt="Logo" style="max-height:60px; max-width:140px; margin-bottom:8px; display:block;" />` : '';
  const win = window.open('', '_blank');
  win.document.write(`
    <!DOCTYPE html><html><head><title>Invoice ${inv.invoiceNumber}</title>
    <style>
      body{ font-family: Arial,sans-serif; padding: 24px; max-width: 800px; margin: 0 auto; }
      .header{ display:flex; justify-content:space-between; margin-bottom:24px; border-bottom:2px solid #0d9488; padding-bottom:16px; }
      .company h2{ margin:0; color:#0d9488; }
      table{ width:100%; border-collapse:collapse; margin:16px 0; }
      th,td{ border:1px solid #ddd; padding:8px; text-align:left; }
      th{ background:#f0fdfa; }
      .text-right{ text-align:right; }
      .totals{ margin-left:auto; width:280px; }
      .totals tr{ border:none; }
      .totals td{ border:none; padding:4px 0; }
      .grand{ font-size:1.2em; font-weight:bold; }
      @media print{ body{padding:0;} }
    </style></head><body>
    <div class="header">
      <div class="company">
        ${logoImg}
        <h2>${company.name}</h2>
        <p>${company.address || ''}<br/>GSTIN: ${company.gstin || '-'}<br/>State: ${company.state || '-'}</p>
      </div>
      <div>
        <h2>TAX INVOICE</h2>
        <p>${headerHtml}</p>
      </div>
    </div>
    ${settings.showBillTo !== false ? `<p><strong>Bill To:</strong><br/>${inv.customerName || ''}<br/>${inv.customerAddress || ''}<br/>GSTIN: ${inv.customerGstin || '-'} | State: ${inv.customerState || '-'}</p>` : ''}
    <table>
      <thead><tr>${theads}</tr></thead>
      <tbody>${tbodyRows}</tbody>
    </table>
    <table class="totals">${summaryRowsHtml}</table>
    ${settings.showTerms && settings.termsText ? `<p style="margin-top:16px;"><strong>Terms:</strong> ${settings.termsText}</p>` : ''}
    ${settings.showNotes && settings.notesText ? `<p><strong>Notes:</strong> ${settings.notesText}</p>` : ''}
    <p style="margin-top:32px; color:#666;">Thank you for your business.</p>
    </body></html>
  `);
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
    <div id="business-modal" class="modal hidden">
      <div class="modal-content modal-wide">
        <h2 id="business-modal-title">Add Business</h2>
        <div class="business-form-tabs">
          <button type="button" class="tab-btn active" data-tab="profile">Profile</button>
          <button type="button" class="tab-btn" data-tab="invoice">Customize Invoice</button>
        </div>
        <form id="business-form">
          <input type="hidden" name="id" />
          <div id="tab-profile" class="tab-pane">
            <div class="form-group"><label>Business Name *</label><input type="text" name="name" required /></div>
            <div class="form-group"><label>Address</label><textarea name="address" rows="3"></textarea></div>
            <div class="form-group"><label>GSTIN</label><input type="text" name="gstin" placeholder="22AAAAA0000A1Z5" /></div>
            <div class="form-group"><label>State</label><input type="text" name="state" /></div>
            <div class="form-group"><label>Phone</label><input type="tel" name="phone" /></div>
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
            <p class="muted" style="margin-bottom:12px;">Choose which columns appear and their <strong>display name</strong> (e.g. change "Qty" to "No of days"). The field type (Qty, Rate, etc.) is used for calculations and does not change.</p>
            <h4>Invoice columns</h4>
            <p class="muted" style="font-size:0.8125rem; margin-bottom:8px;">First column is the field type; second is the name shown on the invoice.</p>
            <div id="invoice-columns-list" class="customize-list"></div>
            <h4 style="margin-top:20px;">Header fields (top of invoice)</h4>
            <div id="invoice-headers-list" class="customize-list"></div>
            <h4 style="margin-top:20px;">Summary rows (totals section)</h4>
            <div id="invoice-summary-list" class="customize-list"></div>
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
    } else {
      renderCustomizeLists(D.defaultInvoiceSettings());
    }
    modal.classList.remove('hidden');
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
    let cols = (settings.columns || []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    cols = cols.length ? cols : D.defaultInvoiceSettings().columns;
    cols.forEach((c, i) => {
      if (!ALL_COLUMN_IDS.includes(c.id)) c.id = ALL_COLUMN_IDS[i] || 'qty';
    });
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
    return { columns, headerFields, summaryRows };
  }

  $('#btn-add-business', container).addEventListener('click', () => openModal(null));

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

// ---------- Init ----------
function init() {
  window.addEventListener('hashchange', () => {
    route();
    setActiveNav((window.location.hash || '#dashboard').split('/')[0].slice(1));
    renderBusinessSwitcher();
  });
  renderBusinessSwitcher();
  route();
  setActiveNav((window.location.hash || '#dashboard').split('/')[0].slice(1));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
