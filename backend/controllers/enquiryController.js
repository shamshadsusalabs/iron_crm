const CustomerEnquiry = require('../models/enquiry');
const multer = require('multer');
const XLSX = require('xlsx');

// Multer memory storage for Excel upload
const upload = multer({ storage: multer.memoryStorage() });
exports.excelUploadMiddleware = upload.single('file');

// List enquiries with pagination and filters
exports.listEnquiries = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search = '',
      status,
      priority,
    } = req.query;

    const q = {};
    if (status) q.status = status;
    if (priority) q.priority = priority;
    if (search) {
      q.$or = [
        { name: new RegExp(search, 'i') },
        { email: new RegExp(search, 'i') },
        { phone: new RegExp(search, 'i') },
        { products: { $elemMatch: { $regex: search, $options: 'i' } } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      CustomerEnquiry.find(q)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .populate('createdBy', 'name email'),
      CustomerEnquiry.countDocuments(q),
    ]);

    res.json({ items, total, page: Number(page), limit: Number(limit) });
  } catch (err) {
    next(err);
  }
};

// Create enquiry
exports.createEnquiry = async (req, res, next) => {
  try {
    const data = req.body || {};
    // Determine creator (User or Admin)
    const creatorId = (req.user && req.user._id) || (req.admin && req.admin._id);
    const creatorModel = req.user ? 'User' : req.admin ? 'Admin' : null;
    if (!creatorId || !creatorModel) {
      return res.status(401).json({ message: 'Unauthorized: missing creator identity' });
    }

    const created = await CustomerEnquiry.create({
      ...data,
      createdBy: creatorId,
      createdByModel: creatorModel,
    });
    // Return populated creator so clients can show name/email immediately
    const populated = await CustomerEnquiry.findById(created._id).populate('createdBy', 'name email');
    res.status(201).json(populated);
  } catch (err) {
    next(err);
  }
};

// Update enquiry
exports.updateEnquiry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = req.body || {};
    const updated = await CustomerEnquiry.findByIdAndUpdate(id, data, { new: true });
    if (!updated) return res.status(404).json({ message: 'Enquiry not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
};

// Delete enquiry
exports.deleteEnquiry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await CustomerEnquiry.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ message: 'Enquiry not found' });
    res.json({ message: 'Enquiry deleted' });
  } catch (err) {
    next(err);
  }
};


// Bulk upload enquiries from Excel/CSV
exports.uploadEnquiriesExcel = async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    // Determine creator (User or Admin)
    const creatorId = (req.user && req.user._id) || (req.admin && req.admin._id);
    const creatorModel = req.user ? 'User' : req.admin ? 'Admin' : null;
    if (!creatorId || !creatorModel) {
      return res.status(401).json({ message: 'Unauthorized: missing creator identity' });
    }

    const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

    // Expected headers: name, email, phone, products, priority, status, notes, source
    const docs = [];
    for (const r of rows) {
      const name = r.name || r.Name || '';
      const email = (r.email || r.Email || '').toString().toLowerCase();
      const phone = r.phone || r.Phone || '';
      const productsRaw = r.products || r.Products || '';
      const products = Array.isArray(productsRaw)
        ? productsRaw
        : typeof productsRaw === 'string' && productsRaw.trim()
        ? productsRaw.split(',').map((s) => s.trim()).filter(Boolean)
        : [];
      const priority = r.priority || r.Priority || 'Medium';
      const status = r.status || r.Status || 'New';
      const notes = r.notes || r.Notes || '';
      const source = r.source || r.Source || '';

      if (!name) continue; // skip incomplete rows

      docs.push({ name, email, phone, products, priority, status, notes, source, createdBy: creatorId, createdByModel: creatorModel });
    }

    if (!docs.length) return res.status(400).json({ message: 'No valid rows found in file' });

    // Insert all docs (do not upsert by default for enquiries)
    const result = await CustomerEnquiry.insertMany(docs, { ordered: false });
    res.json({ message: 'Upload processed', inserted: result.length });
  } catch (err) {
    next(err);
  }
};

