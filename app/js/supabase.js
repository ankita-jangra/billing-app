/**
 * Supabase cloud layer: auth + CRUD for billing data (sync across devices).
 * Load once into in-memory cache; all saves persist to Supabase.
 */

(function () {
  const cfg = window.BillingConfig || {};
  const url = (cfg.supabaseUrl || '').trim();
  const key = (cfg.supabaseAnonKey || '').trim();
  let client = null;

  if (url && key && typeof window.supabase !== 'undefined') {
    const createClient = window.supabase.createClient;
    if (createClient) client = createClient(url, key);
  }

  function getClient() {
    return client;
  }

  function isConfigured() {
    return !!client;
  }

  // ----- Auth -----
  async function getSession() {
    if (!client) return null;
    try {
      const { data, error } = await client.auth.getSession();
      if (error) {
        console.warn('Supabase getSession error', error.message || error);
        return null;
      }
      return (data && data.session) || null;
    } catch (e) {
      console.warn('Supabase getSession failed', e);
      return null;
    }
  }

  async function signUp(email, password) {
    if (!client) return { error: new Error('Supabase not configured') };
    const { data, error } = await client.auth.signUp({ email, password });
    return { data, error };
  }

  async function signIn(email, password) {
    if (!client) return { error: new Error('Supabase not configured') };
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    return { data, error };
  }

  async function signOut() {
    if (!client) return;
    await client.auth.signOut();
  }

  // ----- Map DB row <-> app shape -----
  function businessToApp(row) {
    if (!row) return null;
    return {
      id: row.id,
      name: row.name || 'My Business',
      address: row.address || '',
      gstin: row.gstin || '',
      state: row.state || '',
      phone: row.phone || '',
      tagline: row.tagline || '',
      bankName: row.bank_name || '',
      bankAccountNo: row.bank_account_no || '',
      bankIfsc: row.bank_ifsc || '',
      upiId: row.upi_id || '',
      logo: row.logo || null,
      invoiceNumberPrefix: row.invoice_number_prefix || 'INV',
      invoiceNumberNext: row.invoice_number_next != null ? row.invoice_number_next : 1,
      invoiceNumberIncludeYear: row.invoice_number_include_year !== false,
      isDefault: !!row.is_default,
      invoiceSettings: row.invoice_settings && typeof row.invoice_settings === 'object' ? row.invoice_settings : {},
    };
  }

  function businessToRow(b, userId) {
    return {
      id: b.id,
      user_id: userId,
      name: b.name || 'My Business',
      address: b.address || '',
      gstin: b.gstin || '',
      state: b.state || '',
      phone: b.phone || '',
      tagline: b.tagline || '',
      bank_name: b.bankName || '',
      bank_account_no: b.bankAccountNo || '',
      bank_ifsc: b.bankIfsc || '',
      upi_id: b.upiId || '',
      logo: b.logo || null,
      invoice_number_prefix: b.invoiceNumberPrefix || 'INV',
      invoice_number_next: b.invoiceNumberNext != null ? b.invoiceNumberNext : 1,
      invoice_number_include_year: b.invoiceNumberIncludeYear !== false,
      is_default: !!b.isDefault,
      invoice_settings: b.invoiceSettings || {},
    };
  }

  function customerToApp(row) {
    if (!row) return null;
    return {
      id: row.id,
      businessId: row.business_id,
      name: row.name || '',
      address: row.address || '',
      gstin: row.gstin || '',
      state: row.state || '',
      phone: row.phone || '',
    };
  }

  function customerToRow(c, userId) {
    return {
      id: c.id,
      user_id: userId,
      business_id: c.businessId || '',
      name: c.name || '',
      address: c.address || '',
      gstin: c.gstin || '',
      state: c.state || '',
      phone: c.phone || '',
    };
  }

  function productToApp(row) {
    if (!row) return null;
    return {
      id: row.id,
      businessId: row.business_id,
      name: row.name || '',
      hsn: row.hsn || '',
      rate: parseFloat(row.rate) || 0,
      gstPercent: parseFloat(row.gst_percent) || 18,
      unit: row.unit || 'Pcs',
    };
  }

  function productToRow(p, userId) {
    return {
      id: p.id,
      user_id: userId,
      business_id: p.businessId || '',
      name: p.name || '',
      hsn: p.hsn || '',
      rate: p.rate != null ? p.rate : 0,
      gst_percent: p.gstPercent != null ? p.gstPercent : 18,
      unit: p.unit || 'Pcs',
    };
  }

  function invoiceToApp(row) {
    if (!row) return null;
    return {
      id: row.id,
      businessId: row.business_id,
      invoiceNumber: row.invoice_number,
      customerId: row.customer_id || '',
      customerName: row.customer_name || '',
      customerAddress: row.customer_address || '',
      customerGstin: row.customer_gstin || '',
      customerState: row.customer_state || '',
      date: row.date || '',
      dueDate: row.due_date || '',
      poNumber: row.po_number || '',
      items: Array.isArray(row.items) ? row.items : (row.items && row.items.items ? row.items.items : []),
      subtotal: parseFloat(row.subtotal) || 0,
      discountTotal: parseFloat(row.discount_total) || 0,
      cgstTotal: parseFloat(row.cgst_total) || 0,
      sgstTotal: parseFloat(row.sgst_total) || 0,
      igstTotal: parseFloat(row.igst_total) || 0,
      roundOff: parseFloat(row.round_off) || 0,
      grandTotal: parseFloat(row.grand_total) || 0,
      createdAt: row.created_at,
    };
  }

  function invoiceToRow(inv, userId) {
    return {
      id: inv.id,
      user_id: userId,
      business_id: inv.businessId || '',
      invoice_number: inv.invoiceNumber || '',
      customer_id: inv.customerId || '',
      customer_name: inv.customerName || '',
      customer_address: inv.customerAddress || '',
      customer_gstin: inv.customerGstin || '',
      customer_state: inv.customerState || '',
      date: inv.date || '',
      due_date: inv.dueDate || '',
      po_number: inv.poNumber || '',
      items: inv.items || [],
      subtotal: inv.subtotal != null ? inv.subtotal : 0,
      discount_total: inv.discountTotal != null ? inv.discountTotal : 0,
      cgst_total: inv.cgstTotal != null ? inv.cgstTotal : 0,
      sgst_total: inv.sgstTotal != null ? inv.sgstTotal : 0,
      igst_total: inv.igstTotal != null ? inv.igstTotal : 0,
      round_off: inv.roundOff != null ? inv.roundOff : 0,
      grand_total: inv.grandTotal != null ? inv.grandTotal : 0,
    };
  }

  // ----- Load all (for initial sync) -----
  async function loadAll(userId) {
    if (!client || !userId) return null;

    const [bRes, prefsRes, cRes, pRes, iRes] = await Promise.all([
      client.from('businesses').select('*').eq('user_id', userId).order('created_at'),
      client.from('user_preferences').select('current_business_id').eq('user_id', userId).maybeSingle(),
      client.from('customers').select('*').eq('user_id', userId).order('created_at'),
      client.from('products').select('*').eq('user_id', userId).order('created_at'),
      client.from('invoices').select('*').eq('user_id', userId).order('created_at'),
    ]);

    if (bRes.error) throw bRes.error;
    const businesses = (bRes.data || []).map(businessToApp);
    const currentBusinessId = (prefsRes.data && prefsRes.data.current_business_id) ? prefsRes.data.current_business_id : (businesses[0] && businesses[0].id) || '';
    const customers = (cRes.data || []).map(customerToApp);
    const products = (pRes.data || []).map(productToApp);
    const invoices = (iRes.data || []).map(invoiceToApp);

    return {
      businesses,
      currentBusinessId,
      customers,
      products,
      invoices,
    };
  }

  // ----- Saves (upsert full list or single row) -----
  async function saveBusinesses(list, userId) {
    if (!client || !userId || !list || !list.length) return;
    const rows = list.map((b) => businessToRow(b, userId));
    const { error } = await client.from('businesses').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }

  async function setCurrentBusinessId(id, userId) {
    if (!client || !userId) return;
    await client.from('user_preferences').upsert({ user_id: userId, current_business_id: id || '' }, { onConflict: 'user_id' });
  }

  async function saveCustomers(list, userId) {
    if (!client || !userId) return;
    const rows = list.map((c) => customerToRow(c, userId));
    const { error } = await client.from('customers').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }

  async function saveProducts(list, userId) {
    if (!client || !userId) return;
    const rows = list.map((p) => productToRow(p, userId));
    const { error } = await client.from('products').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }

  async function saveInvoices(list, userId) {
    if (!client || !userId) return;
    const rows = list.map((inv) => invoiceToRow(inv, userId));
    const { error } = await client.from('invoices').upsert(rows, { onConflict: 'id' });
    if (error) throw error;
  }

  async function deleteBusiness(id, userId) {
    if (!client || !userId) return;
    await client.from('businesses').delete().eq('id', id).eq('user_id', userId);
  }

  async function deleteCustomer(id, userId) {
    if (!client || !userId) return;
    await client.from('customers').delete().eq('id', id).eq('user_id', userId);
  }

  async function deleteProduct(id, userId) {
    if (!client || !userId) return;
    await client.from('products').delete().eq('id', id).eq('user_id', userId);
  }

  async function deleteInvoice(id, userId) {
    if (!client || !userId) return;
    await client.from('invoices').delete().eq('id', id).eq('user_id', userId);
  }

  window.BillingCloud = {
    getClient,
    isConfigured,
    getSession,
    signUp,
    signIn,
    signOut,
    loadAll,
    saveBusinesses,
    setCurrentBusinessId,
    saveCustomers,
    saveProducts,
    saveInvoices,
    deleteBusiness,
    deleteCustomer,
    deleteProduct,
    deleteInvoice,
  };
})();
