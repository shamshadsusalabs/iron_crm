const Customer = require('../models/customer');
const Enquiry = require('../models/enquiry');
const Template = require('../models/follow-up/Template');
const Followup = require('../models/follow-up/Followup');
const CatalogItem = require('../models/catalog/CatalogItem');

// Helper: start of day/week/month
function startOfDay(d=new Date()){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function startOfWeek(d=new Date()){ const x=startOfDay(d); const day=(x.getDay()+6)%7; x.setDate(x.getDate()-day); return x; }
function monthsBack(n){ const x=new Date(); x.setMonth(x.getMonth()-n); x.setDate(1); x.setHours(0,0,0,0); return x; }
function daysBack(n){ const x=new Date(); x.setDate(x.getDate()-n); x.setHours(0,0,0,0); return x; }

exports.summary = async (req, res, next) => {
  try {
    const [customersTotal, customersLast30d, enquiriesTotal, enquiriesToday, enquiriesThisWeek, enquiriesByStatusAgg, recentWindowEnquiriesTotal] = await Promise.all([
      Customer.countDocuments({}),
      Customer.countDocuments({ createdAt: { $gte: daysBack(30) } }),
      Enquiry.countDocuments({}),
      Enquiry.countDocuments({ createdAt: { $gte: startOfDay(new Date()) } }),
      Enquiry.countDocuments({ createdAt: { $gte: startOfWeek(new Date()) } }),
      Enquiry.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Enquiry.countDocuments({ createdAt: { $gte: daysBack(30) } }),
    ]);

    // Overdue open enquiries (>7 days, not Closed)
    const overdueOpen = await Enquiry.countDocuments({
      status: { $in: ['New', 'In Progress', 'Responded'] },
      createdAt: { $lt: daysBack(7) },
    });

    const enquiriesByStatus = enquiriesByStatusAgg.reduce((acc, it) => { acc[it._id||'Unknown'] = it.count; return acc; }, {});
    const conversionRate = 0;

    res.json({
      customers: { total: customersTotal, last30d: customersLast30d },
      enquiries: { total: enquiriesTotal, today: enquiriesToday, thisWeek: enquiriesThisWeek, byStatus: enquiriesByStatus, conversionRate, overdueOpen },
    });
  } catch (err) { next(err); }
};

exports.recent = async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
    const [recentEnquiries, recentCustomers] = await Promise.all([
      Enquiry.find({}).sort({ createdAt: -1 }).limit(limit).select('name email phone status priority createdAt source products').lean(),
      Customer.find({}).sort({ createdAt: -1 }).limit(limit).select('name email status createdAt').lean(),
    ]);
    res.json({ enquiries: recentEnquiries, customers: recentCustomers });
  } catch (err) { next(err); }
};

exports.timeseries = async (req, res, next) => {
  try {
    const { start, end } = req.query;
    const endDate = end ? new Date(end) : new Date();
    const startDate = start ? new Date(start) : monthsBack(11);

    // Customers monthly (last 12 months within range)
    const customersMonthly = await Customer.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]);

    // Enquiries weekly (ISO week)
    const enquiriesWeekly = await Enquiry.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: { y: { $isoWeekYear: '$createdAt' }, w: { $isoWeek: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.y': 1, '_id.w': 1 } },
    ]);

    // Enquiry status distribution in range
    const enquiriesByStatus = await Enquiry.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // Priority distribution
    const enquiriesByPriority = await Enquiry.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$priority', count: { $sum: 1 } } },
    ]);

    // Top products from enquiries
    const topProducts = await Enquiry.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      { $unwind: '$products' },
      { $group: { _id: '$products', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    // Top sources
    const topSources = await Enquiry.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$source', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);

    // Followups per month (scheduled and sent)
    const followupsMonthlyScheduled = await Followup.aggregate([
      { $match: { scheduledAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: { y: { $year: '$scheduledAt' }, m: { $month: '$scheduledAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]);
    const followupsMonthlySent = await Followup.aggregate([
      { $match: { sentAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: { y: { $year: '$sentAt' }, m: { $month: '$sentAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]);

    // Catalog items per month
    const catalogMonthly = await CatalogItem.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, count: { $sum: 1 } } },
      { $sort: { '_id.y': 1, '_id.m': 1 } },
    ]);

    // Ageing buckets for open enquiries
    const now = new Date();
    const openStatuses = ['New', 'In Progress', 'Responded'];
    const openEnquiries = await Enquiry.aggregate([
      { $match: { status: { $in: openStatuses } } },
      { $project: { ageDays: { $divide: [{ $subtract: [now, '$createdAt'] }, 1000 * 60 * 60 * 24] } } },
      { $bucket: {
          groupBy: '$ageDays',
          boundaries: [0, 4, 8, 15, 100000],
          default: '100000+',
          output: { count: { $sum: 1 } }
        }
      }
    ]);

    // Previously: conversion by source/product used linkedCustomerId; removed due to decoupling

    // Team performance (assignedTo)
    const teamPerformance = await Enquiry.aggregate([
      { $group: {
          _id: '$assignedTo',
          total: { $sum: 1 },
          closed: { $sum: { $cond: [{ $eq: ['$status', 'Closed'] }, 1, 0] } }
        }
      },
      { $sort: { total: -1 } }
    ]);

    res.json({ 
      customersMonthly, 
      enquiriesWeekly, 
      enquiriesByStatus, 
      enquiriesByPriority, 
      topProducts, 
      topSources, 
      followupsMonthly: { scheduled: followupsMonthlyScheduled, sent: followupsMonthlySent }, 
      catalogMonthly,
      ageingBuckets: openEnquiries,
      conversionBySource: [],
      conversionByProduct: [],
      teamPerformance,
    });
  } catch (err) { next(err); }
};
