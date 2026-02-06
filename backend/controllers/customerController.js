const Customer = require('../models/customer');
const multer = require('multer');
const XLSX = require('xlsx');

// Multer memory storage for Excel upload
const upload = multer({ storage: multer.memoryStorage() });
exports.excelUploadMiddleware = upload.single('file');

// Build query helper
function buildSearchQuery(q) {
  if (!q) return {};
  const regex = { $regex: q, $options: 'i' };
  return {
    $or: [
      { name: regex },
      { email: regex },
      { phone: regex },
      { address: regex },
      { status: regex },
    ],
  };
}

// List customers with pagination and optional search
exports.listCustomers = async (req, res) => {
  try {
    const { page = 1, limit = 20, q, status } = req.query;
    const query = buildSearchQuery(q);

    if (status) query.status = status;

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      Customer.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('createdBy', 'name email'),
      Customer.countDocuments(query),
    ]);

    res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch customers', error: err.message });
  }
};

// Get single customer
exports.getCustomer = async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch customer', error: err.message });
  }
};

// Create customer
exports.createCustomer = async (req, res) => {
  try {
    const { name, email, phone, address, status, interestedProducts, history, notes } = req.body;
    if (!name || !email) return res.status(400).json({ message: 'name and email are required' });


    const effectiveStatus = status || 'Warm';
    const interestedArr = Array.isArray(interestedProducts)
      ? interestedProducts
      : typeof interestedProducts === 'string' && interestedProducts.trim()
        ? interestedProducts.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
    const historyArr = Array.isArray(history) ? [...history] : [];
    historyArr.push({ date: new Date(), action: 'Created', details: `Status: ${effectiveStatus}` });

    // Determine creator (User or Admin)
    const creatorId = (req.user && req.user._id) || (req.admin && req.admin._id);
    const creatorModel = req.user ? 'User' : req.admin ? 'Admin' : null;
    if (!creatorId || !creatorModel) {
      return res.status(401).json({ message: 'Unauthorized: missing creator identity' });
    }

    const doc = await Customer.create({
      name,
      email: String(email).toLowerCase(),
      phone,
      address,
      status: effectiveStatus,
      interestedProducts: interestedArr,
      history: historyArr,
      notes,
      createdBy: creatorId,
      createdByModel: creatorModel,
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ message: 'Failed to create customer', error: err.message });
  }
};

// Update customer
exports.updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, address, status, interestedProducts, history, notes } = req.body;

    const prev = await Customer.findById(id);
    if (!prev) return res.status(404).json({ message: 'Customer not found' });

    const update = {};
    if (typeof name !== 'undefined') update.name = name;
    if (typeof email !== 'undefined') update.email = String(email).toLowerCase();
    if (typeof phone !== 'undefined') update.phone = phone;
    if (typeof address !== 'undefined') update.address = address;
    if (typeof status !== 'undefined') update.status = status;
    if (typeof interestedProducts !== 'undefined') {
      update.interestedProducts = Array.isArray(interestedProducts)
        ? interestedProducts
        : typeof interestedProducts === 'string' && interestedProducts.trim()
          ? interestedProducts.split(',').map((s) => s.trim()).filter(Boolean)
          : [];
    }
    if (typeof history !== 'undefined') update.history = Array.isArray(history) ? history : [];
    if (typeof notes !== 'undefined') update.notes = notes;

    const updateOps = { $set: update };
    if (typeof status !== 'undefined' && prev.status !== status) {
      updateOps.$push = {
        history: { date: new Date(), action: 'Status Updated', details: `${prev.status || '-'} → ${status}` },
      };
    }

    const updated = await Customer.findByIdAndUpdate(id, updateOps, { new: true });
    res.json(updated);
  } catch (err) {
    // Handle unique email conflict
    if (err?.code === 11000) {
      return res.status(409).json({ message: 'Email already exists' });
    }
    res.status(500).json({ message: 'Failed to update customer', error: err.message });
  }
};

// Delete customer
exports.deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await Customer.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'Customer not found' });
    res.json({ message: 'Customer deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to delete customer', error: err.message });
  }
};

// Bulk upload customers from Excel/CSV
exports.uploadCustomersExcel = async (req, res) => {
  console.log('\n=== CSV UPLOAD REQUEST RECEIVED ===');
  console.log('Request file:', req.file ? 'File present' : 'No file');
  console.log('File details:', req.file ? {
    originalname: req.file.originalname,
    mimetype: req.file.mimetype,
    size: req.file.size
  } : 'No file details');

  try {
    if (!req.file) {
      console.log('ERROR: No file uploaded');
      return res.status(400).json({ message: 'No file uploaded' });
    }
    // Determine creator (User or Admin) for inserted docs
    const creatorId = (req.user && req.user._id) || (req.admin && req.admin._id);
    const creatorModel = req.user ? 'User' : req.admin ? 'Admin' : null;
    if (!creatorId || !creatorModel) {
      return res.status(401).json({ message: 'Unauthorized: missing creator identity' });
    }
    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    // Expected columns: name, email, phone, address, status, interestedProducts (or "Interested Products"), notes, createdBy (or "Created By")
    console.log('Processing CSV rows. Total rows:', rows.length);
    console.log('First row keys:', rows.length > 0 ? Object.keys(rows[0]) : 'No rows');

    const docs = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      console.log(`\n--- Processing row ${i + 1} ---`);
      console.log('Raw row data:', r);

      const name = r.name || r.Name || r.fullname || r.FullName || '';
      const email = (r.email || r.Email || '').toString().toLowerCase();
      if (!name || !email) {
        console.log('Skipping row - missing name or email:', { name, email });
        continue; // skip incomplete
      }

      const phone = r.phone || r.Phone || '';
      const address = r.address || r.Address || '';
      const status = r.status || r.Status || 'Warm';

      // Debug interested products extraction
      const interestedRaw = r.interestedProducts || r.InterestedProducts || r['Interested Products'] || r['interested products'] || r.products || r.Products || '';
      console.log('Interested products extraction:');
      console.log('  r.interestedProducts:', r.interestedProducts);
      console.log('  r.InterestedProducts:', r.InterestedProducts);
      console.log('  r["Interested Products"]:', r['Interested Products']);
      console.log('  r["interested products"]:', r['interested products']);
      console.log('  r.products:', r.products);
      console.log('  r.Products:', r.Products);
      console.log('  Final interestedRaw:', interestedRaw);

      const notes = r.notes || r.Notes || '';
      const createdByName = r.createdBy || r['Created By'] || r.CreatedBy || '';

      const interestedProducts = Array.isArray(interestedRaw)
        ? interestedRaw
        : typeof interestedRaw === 'string' && interestedRaw.trim()
          ? interestedRaw.split(',').map((s) => s.trim()).filter(Boolean)
          : [];

      console.log('Final interestedProducts array:', interestedProducts);

      // If there's a createdByName from CSV, append it to notes for reference
      const finalNotes = createdByName && createdByName !== notes
        ? `${notes}${notes ? ' | ' : ''}Created by: ${createdByName}`.trim()
        : notes;

      const docData = { name, email, phone, address, status, interestedProducts, notes: finalNotes };
      console.log('Final document data:', docData);
      docs.push(docData);
    }

    if (!docs.length) return res.status(400).json({ message: 'No valid rows found in file' });

    // Upsert by email to avoid duplicates
    const ops = docs.map((d) => ({
      updateOne: {
        filter: { email: d.email },
        update: {
          $set: d,
          $setOnInsert: {
            history: [
              { date: new Date(), action: 'Created', details: `Status: ${d.status || 'Warm'}` },
            ],
            createdBy: creatorId,
            createdByModel: creatorModel,
          },
        },
        upsert: true,
      },
    }));

    console.log('Executing bulk write operations...');
    const result = await Customer.bulkWrite(ops, { ordered: false });
    console.log('Bulk write result:', result);

    // Let's also fetch and log a few created/updated customers to verify
    const sampleEmails = docs.slice(0, 3).map(d => d.email);
    const sampleCustomers = await Customer.find({ email: { $in: sampleEmails } }).limit(3);
    console.log('Sample customers after upload:', sampleCustomers);

    res.json({ message: 'Upload processed', result });
  } catch (err) {
    res.status(500).json({ message: 'Failed to process upload', error: err.message });
  }
};
