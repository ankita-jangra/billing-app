/**
 * Billing app data layer - localStorage
 * Multi-business: each business has own invoice sequence, logo, customers, products, invoices.
 */

const DATA_KEYS = {
  company: 'billing_company',
  businesses: 'billing_businesses',
  currentBusinessId: 'billing_currentBusinessId',
  customers: 'billing_customers',
  products: 'billing_products',
  invoices: 'billing_invoices',
};

// Default invoice column definitions (id, default label, visible). Order = display order.
const DEFAULT_INVOICE_COLUMNS = [
  { id: 'sr', label: 'S.No', visible: true, order: 0 },
  { id: 'particulars', label: 'Particulars', visible: true, order: 1 },
  { id: 'hsn', label: 'HSN', visible: true, order: 2 },
  { id: 'unit', label: 'Unit', visible: true, order: 3 },
  { id: 'qty', label: 'Qty', visible: true, order: 4 },
  { id: 'rate', label: 'Rate', visible: true, order: 5 },
  { id: 'discount', label: 'Discount', visible: false, order: 6 },
  { id: 'taxable', label: 'Taxable Value', visible: true, order: 7 },
  { id: 'cgst', label: 'CGST', visible: true, order: 8 },
  { id: 'sgst', label: 'SGST', visible: true, order: 9 },
  { id: 'igst', label: 'IGST', visible: false, order: 10 },
  { id: 'amount', label: 'Amount', visible: true, order: 11 },
];

const DEFAULT_HEADER_FIELDS = [
  { id: 'invoiceNumber', label: 'Invoice No', visible: true },
  { id: 'date', label: 'Date', visible: true },
  { id: 'dueDate', label: 'Due Date', visible: false },
  { id: 'poNumber', label: 'PO No', visible: false },
];

const DEFAULT_SUMMARY_ROWS = [
  { id: 'subtotal', label: 'Subtotal', visible: true },
  { id: 'discountTotal', label: 'Discount', visible: false },
  { id: 'cgstTotal', label: 'CGST Total', visible: true },
  { id: 'sgstTotal', label: 'SGST Total', visible: true },
  { id: 'igstTotal', label: 'IGST Total', visible: false },
  { id: 'roundOff', label: 'Round Off', visible: true },
  { id: 'grandTotal', label: 'Grand Total', visible: true },
];

function defaultInvoiceSettings() {
  return {
    columns: JSON.parse(JSON.stringify(DEFAULT_INVOICE_COLUMNS)),
    headerFields: JSON.parse(JSON.stringify(DEFAULT_HEADER_FIELDS)),
    summaryRows: JSON.parse(JSON.stringify(DEFAULT_SUMMARY_ROWS)),
    showBillTo: true,
    showShipTo: false,
    showTerms: false,
    termsText: '',
    showNotes: false,
    notesText: '',
  };
}

// ----- Current business (which business the user is working in) -----
function getCurrentBusinessId() {
  const id = localStorage.getItem(DATA_KEYS.currentBusinessId);
  if (id) return id;
  const def = getDefaultBusiness();
  return def ? def.id : (getBusinesses()[0] && getBusinesses()[0].id) || '';
}

function setCurrentBusinessId(id) {
  if (id) localStorage.setItem(DATA_KEYS.currentBusinessId, id);
}

// ----- Businesses -----
function getBusinesses() {
  let list = localStorage.getItem(DATA_KEYS.businesses);
  if (list) return JSON.parse(list);
  const old = localStorage.getItem(DATA_KEYS.company);
  if (old) {
    const c = JSON.parse(old);
    list = [{
      id: '1',
      name: c.name || 'My Business',
      address: c.address || '',
      gstin: c.gstin || '',
      state: c.state || '',
      phone: '',
      logo: null,
      invoiceNumberPrefix: 'INV',
      invoiceNumberNext: 1,
      invoiceNumberIncludeYear: true,
      isDefault: true,
      invoiceSettings: defaultInvoiceSettings(),
    }];
    saveBusinesses(list);
    return list;
  }
  list = [{
    id: '1',
    name: 'My Business',
    address: '123, Business Street, City - 400001',
    gstin: '27XXXXX1234X1ZX',
    state: 'Maharashtra',
    phone: '',
    logo: null,
    invoiceNumberPrefix: 'INV',
    invoiceNumberNext: 1,
    invoiceNumberIncludeYear: true,
    isDefault: true,
    invoiceSettings: defaultInvoiceSettings(),
  }];
  saveBusinesses(list);
  return list;
}

function saveBusinesses(list) {
  localStorage.setItem(DATA_KEYS.businesses, JSON.stringify(list));
}

function getDefaultBusiness() {
  const list = getBusinesses();
  const def = list.find((b) => b.isDefault);
  return def || list[0] || null;
}

function getBusinessById(id) {
  return getBusinesses().find((b) => b.id === id) || null;
}

function setDefaultBusiness(id) {
  const list = getBusinesses();
  list.forEach((b) => { b.isDefault = b.id === id; });
  saveBusinesses(list);
}

function addBusiness(business) {
  const list = getBusinesses();
  const next = nextId(list);
  const b = {
    name: business.name || 'New Business',
    address: business.address || '',
    gstin: business.gstin || '',
    state: business.state || '',
    phone: business.phone || '',
    logo: business.logo || null,
    invoiceNumberPrefix: business.invoiceNumberPrefix != null ? business.invoiceNumberPrefix : 'INV',
    invoiceNumberNext: business.invoiceNumberNext != null ? business.invoiceNumberNext : 1,
    invoiceNumberIncludeYear: business.invoiceNumberIncludeYear !== false,
    id: next,
    isDefault: list.length === 0,
    invoiceSettings: business.invoiceSettings ? { ...defaultInvoiceSettings(), ...business.invoiceSettings } : defaultInvoiceSettings(),
  };
  if (!b.invoiceSettings.columns) b.invoiceSettings.columns = defaultInvoiceSettings().columns;
  if (!b.invoiceSettings.headerFields) b.invoiceSettings.headerFields = defaultInvoiceSettings().headerFields;
  if (!b.invoiceSettings.summaryRows) b.invoiceSettings.summaryRows = defaultInvoiceSettings().summaryRows;
  list.push(b);
  saveBusinesses(list);
  return b;
}

function updateBusiness(id, data) {
  const list = getBusinesses();
  const i = list.findIndex((b) => b.id === id);
  if (i === -1) return null;
  const next = { ...list[i], ...data };
  if (data.invoiceSettings) {
    next.invoiceSettings = { ...list[i].invoiceSettings, ...data.invoiceSettings };
    if (data.invoiceSettings.columns) next.invoiceSettings.columns = data.invoiceSettings.columns;
    if (data.invoiceSettings.headerFields) next.invoiceSettings.headerFields = data.invoiceSettings.headerFields;
    if (data.invoiceSettings.summaryRows) next.invoiceSettings.summaryRows = data.invoiceSettings.summaryRows;
  }
  list[i] = next;
  saveBusinesses(list);
  return list[i];
}

function deleteBusiness(id) {
  const list = getBusinesses().filter((b) => b.id !== id);
  if (list.length && getDefaultBusiness()?.id === id) list[0].isDefault = true;
  if (getCurrentBusinessId() === id && list.length) setCurrentBusinessId(list[0].id);
  saveBusinesses(list);
}

// ----- Invoice number sequence (per business) -----
function getNextInvoiceNumber(businessId) {
  const b = getBusinessById(businessId);
  if (!b) return 'INV-2025-0001';
  const prefix = (b.invoiceNumberPrefix || 'INV').replace(/\s+/g, '-');
  const includeYear = b.invoiceNumberIncludeYear !== false;
  const year = new Date().getFullYear();
  const next = b.invoiceNumberNext != null ? b.invoiceNumberNext : 1;
  const part = includeYear ? `${prefix}-${year}-${String(next).padStart(4, '0')}` : `${prefix}-${String(next).padStart(4, '0')}`;
  return part;
}

function incrementBusinessInvoiceNumber(businessId) {
  const list = getBusinesses();
  const i = list.findIndex((b) => b.id === businessId);
  if (i === -1) return;
  const next = list[i].invoiceNumberNext != null ? list[i].invoiceNumberNext + 1 : 2;
  list[i].invoiceNumberNext = next;
  saveBusinesses(list);
}

// Backward compatibility
function getCompany() {
  const b = getDefaultBusiness();
  return b ? { name: b.name, address: b.address, gstin: b.gstin, state: b.state } : { name: 'My Business', address: '', gstin: '', state: '' };
}

function saveCompany(data) {
  const b = getDefaultBusiness();
  if (b) updateBusiness(b.id, data);
  else addBusiness({ ...data, isDefault: true });
}

// ----- Customers (per business) -----
function getCustomers(businessId) {
  const d = localStorage.getItem(DATA_KEYS.customers);
  let list = d ? JSON.parse(d) : [
    { id: '1', businessId: '1', name: 'ABC Traders', address: '456, Market Rd', gstin: '27YYYYY5678Y1ZY', state: 'Maharashtra', phone: '9876543210' },
    { id: '2', businessId: '1', name: 'XYZ Retail', address: '789, MG Road', gstin: '29ZZZZZ9012Z1ZZ', state: 'Karnataka', phone: '9123456789' },
  ];
  const defaultBid = (getBusinesses()[0] && getBusinesses()[0].id) || '1';
  let changed = false;
  list = list.map((c) => {
    if (!c.businessId) { c.businessId = defaultBid; changed = true; }
    return c;
  });
  if (changed) saveCustomers(list);
  if (businessId) return list.filter((c) => c.businessId === businessId);
  return list;
}

function saveCustomers(list) {
  localStorage.setItem(DATA_KEYS.customers, JSON.stringify(list));
}

function addCustomer(customer, businessId) {
  const list = getCustomers();
  const newC = { ...customer, id: nextId(list), businessId: businessId || getCurrentBusinessId() };
  list.push(newC);
  saveCustomers(list);
  return newC;
}

function updateCustomer(id, data) {
  const list = getCustomers();
  const i = list.findIndex((c) => c.id === id);
  if (i === -1) return null;
  list[i] = { ...list[i], ...data };
  saveCustomers(list);
  return list[i];
}

function deleteCustomer(id) {
  const list = getCustomers().filter((c) => c.id !== id);
  saveCustomers(list);
}

// ----- Products (per business) -----
function getProducts(businessId) {
  const d = localStorage.getItem(DATA_KEYS.products);
  let list = d ? JSON.parse(d) : [
    { id: '1', businessId: '1', name: 'Product A', hsn: '8471', rate: 1000, gstPercent: 18, unit: 'Pcs' },
    { id: '2', businessId: '1', name: 'Product B', hsn: '8473', rate: 2500, gstPercent: 18, unit: 'Pcs' },
    { id: '3', businessId: '1', name: 'Service Fee', hsn: '9983', rate: 500, gstPercent: 18, unit: 'Nos' },
  ];
  const defaultBid = (getBusinesses()[0] && getBusinesses()[0].id) || '1';
  let changed = false;
  list = list.map((p) => {
    if (!p.businessId) { p.businessId = defaultBid; changed = true; }
    return p;
  });
  if (changed) saveProducts(list);
  if (businessId) return list.filter((p) => p.businessId === businessId);
  return list;
}

function saveProducts(list) {
  localStorage.setItem(DATA_KEYS.products, JSON.stringify(list));
}

function addProduct(product, businessId) {
  const list = getProducts();
  const newP = { ...product, id: nextId(list), businessId: businessId || getCurrentBusinessId() };
  list.push(newP);
  saveProducts(list);
  return newP;
}

function updateProduct(id, data) {
  const list = getProducts();
  const i = list.findIndex((p) => p.id === id);
  if (i === -1) return null;
  list[i] = { ...list[i], ...data };
  saveProducts(list);
  return list[i];
}

function deleteProduct(id) {
  const list = getProducts().filter((p) => p.id !== id);
  saveProducts(list);
}

// ----- Invoices (filter by business when needed) -----
function getInvoices(businessId) {
  const d = localStorage.getItem(DATA_KEYS.invoices);
  let list = d ? JSON.parse(d) : [];
  if (businessId) list = list.filter((inv) => inv.businessId === businessId);
  return list;
}

function saveInvoices(list) {
  localStorage.setItem(DATA_KEYS.invoices, JSON.stringify(list));
}

function nextId(list, key = 'id') {
  const ids = list.map((x) => parseInt(x[key], 10)).filter((n) => !isNaN(n));
  return String((ids.length ? Math.max(...ids) : 0) + 1);
}

function addInvoice(invoice) {
  const allInvoices = getInvoices();
  const inv = {
    ...invoice,
    id: nextId(allInvoices),
    createdAt: new Date().toISOString(),
  };
  // Always use business sequence for new invoices so the counter increments
  if (inv.businessId) {
    inv.invoiceNumber = getNextInvoiceNumber(inv.businessId);
    incrementBusinessInvoiceNumber(inv.businessId);
  } else if (!inv.invoiceNumber) {
    const bid = getCurrentBusinessId() || (getBusinesses()[0] && getBusinesses()[0].id);
    if (bid) {
      inv.businessId = bid;
      inv.invoiceNumber = getNextInvoiceNumber(bid);
      incrementBusinessInvoiceNumber(bid);
    }
  }
  allInvoices.unshift(inv);
  saveInvoices(allInvoices);
  return inv;
}

function updateInvoice(id, data) {
  const list = getInvoices();
  const i = list.findIndex((inv) => inv.id === id);
  if (i === -1) return null;
  list[i] = { ...list[i], ...data };
  saveInvoices(list);
  return list[i];
}

function getInvoiceById(id) {
  return getInvoices().find((inv) => inv.id === id) || null;
}

function deleteInvoice(id) {
  const list = getInvoices().filter((inv) => inv.id !== id);
  saveInvoices(list);
}

window.BillingData = {
  getCompany,
  saveCompany,
  getCurrentBusinessId,
  setCurrentBusinessId,
  getBusinesses,
  getDefaultBusiness,
  getBusinessById,
  setDefaultBusiness,
  addBusiness,
  updateBusiness,
  deleteBusiness,
  getNextInvoiceNumber,
  incrementBusinessInvoiceNumber,
  defaultInvoiceSettings,
  getCustomers,
  saveCustomers,
  addCustomer,
  updateCustomer,
  deleteCustomer,
  getProducts,
  saveProducts,
  addProduct,
  updateProduct,
  deleteProduct,
  getInvoices,
  saveInvoices,
  addInvoice,
  updateInvoice,
  getInvoiceById,
  deleteInvoice,
};
