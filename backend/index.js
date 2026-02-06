const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const { connectDB } = require('./config/db');
const { startCronJobs } = require('./services/cronService');
const emailEvents = require('./services/emailEvents');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Rate limiting
// const limiter = rateLimit({
//   windowMs: 15 * 60 * 1000,
//   max: 100,
//   message: 'Too many requests from this IP, please try again later.'
// });
// app.use('/api/', limiter);

// CORS config
const allowedOrigins = [
  process.env.FRONTEND_URL || 'https://crmfrontend-dbc12.web.app',
  'https://crmfrontend-dbc12.web.app',
  'https://crmfrontend-dbc12.firebaseapp.com'
];

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-id', 'x-user-id', 'x-role', 'X-Requested-With', 'x-refresh-token', 'Access-Control-Allow-Origin']
}));

// Note: cors() middleware already handles preflight; no explicit app.options needed for Express 5


// Body parser
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
const adminRoutes = require('./routes/adminRoutes');
app.use('/api/admin', adminRoutes);

// Merchandiser auth routes
const merchRoutes = require('./routes/merchRoutes');
app.use('/api/merch', merchRoutes);

// Email settings routes (JWT-protected)
const adminEmailSettingsRoutes = require('./routes/adminEmailSettingsRoutes');
app.use('/api/admin/email-settings', adminEmailSettingsRoutes);

const merchEmailSettingsRoutes = require('./routes/merchEmailSettingsRoutes');
app.use('/api/merch/email-settings', merchEmailSettingsRoutes);

const emailRoutes = require('./routes/emailRoutes');
app.use('/api/emails', emailRoutes);

const followupRoutes = require('./routes/followupRoutes');
// Admin-mounted (legacy)
app.use('/api/admin/api/followup', followupRoutes);
// Public (admin/merch via query-based auth)
app.use('/api/follow-up', followupRoutes);
// Aliases for consistency with various frontends
app.use('/api/followups', followupRoutes);
app.use('/api/follow-ups', followupRoutes);

// Catalog routes
const catalogRoutes = require('./routes/catalogRoutes');
app.use('/api/catalog', catalogRoutes);

// Merch catalog routes (JWT-protected)
const merchCatalogRoutes = require('./routes/merchCatalogRoutes');
app.use('/api/merch/catalog', merchCatalogRoutes);

// User management routes
const userRoutes = require('./routes/userRoutes');
app.use('/api/admin/users', userRoutes);

// Dashboard routes
const dashboardRoutes = require('./routes/dashboardRoutes');
app.use('/api/admin/dashboard', dashboardRoutes);

// Reporting routes
const reportingRoutes = require('./routes/reportingRoutes');
app.use('/api/admin/reports', reportingRoutes);

// Customer routes (CRUD + Excel upload)
const customerRoutes = require('./routes/customerRoutes');
app.use('/api/admin/customers', customerRoutes);

// Enquiry routes (list/create/update/convert)
const enquiryRoutes = require('./routes/enquiryRoutes');
app.use('/api/admin/enquiries', enquiryRoutes);

// Merch enquiries (JWT-protected, scoped to merch user)
const merchEnquiryRoutes = require('./routes/merchEnquiryRoutes');
app.use('/api/merch/enquiries', merchEnquiryRoutes);

// Merch customers (JWT-protected, scoped to merch user)
const merchCustomerRoutes = require('./routes/merchCustomerRoutes');
app.use('/api/merch/customers', merchCustomerRoutes);

// Email tracking routes
const trackingRoutes = require('./routes/trackingRoutes');
app.use('/api/tracking', trackingRoutes);

// Campaign stats routes
const campaignStatsRoutes = require('./routes/campaignStatsRoutes');
app.use('/api/campaign-stats', campaignStatsRoutes);

// Fix tracking routes
const fixTrackingRoutes = require('./routes/fixTrackingRoutes');
app.use('/api/fix-tracking', fixTrackingRoutes);

// Health check
app.get('/', (req, res) => {
  res.send('API Running...');
});

// SSE stream for email events
app.get('/api/emails/stream', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders && res.flushHeaders();

  // Initial hello to establish stream
  res.write(`event: ping\n` + `data: "connected"\n\n`);

  emailEvents.addClient(res);

  // Heartbeat to keep the connection alive
  const interval = setInterval(() => {
    try {
      res.write(`event: ping\n` + `data: "keep-alive"\n\n`);
    } catch {
      clearInterval(interval);
    }
  }, 25000);

  req.on('close', () => {
    clearInterval(interval);
    emailEvents.removeClient(res);
  });
});

// Error handling middleware (must be last)
const { errorHandler } = require('./middleware/errorHandler');
app.use(errorHandler);

// ✅ Start server after DB connects
const startServer = async () => {
  try {
    // Connect to database first
    await connectDB();

    // Start the server
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);

      // Start cron jobs after server starts
      startCronJobs();

      // Initialize SSE for email events
      emailEvents.initialize();

    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
  }
};

startServer();
