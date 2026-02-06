const Customer = require('../models/customer');
const Enquiry = require('../models/enquiry');
let EmailTracking;
try { EmailTracking = require('../models/follow-up/EmailTracking'); } catch { EmailTracking = null; }

function parseRange(q){
  const end = q.end ? new Date(q.end) : new Date();
  const start = q.start ? new Date(q.start) : new Date(end.getFullYear(), end.getMonth(), 1);
  return { start, end };
}

exports.summary = async (req, res, next) => {
  try {
    const { start, end } = parseRange(req.query);

    const [customerDaily, enquiriesDaily, leadStatus, activitiesEnq, activitiesCust] = await Promise.all([
      Customer.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: { d: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } }, count: { $sum: 1 } } },
        { $sort: { '_id.d': 1 } },
      ]),
      Enquiry.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: { d: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } } }, count: { $sum: 1 } } },
        { $sort: { '_id.d': 1 } },
      ]),
      Enquiry.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      Enquiry.find({ createdAt: { $gte: start, $lte: end } }).sort({ createdAt: -1 }).limit(10).select('name email phone status priority createdAt').lean(),
      Customer.find({ createdAt: { $gte: start, $lte: end } }).sort({ createdAt: -1 }).limit(10).select('name email status createdAt').lean(),
    ]);

    // Activities merge
    const activities = [
      ...activitiesEnq.map(e => ({
        type: 'Enquiry',
        date: e.createdAt,
        user: e.email || e.phone || e.name,
        activity: `${e.status} enquiry`,
        details: e.name || e.email || e.phone,
      })),
      ...activitiesCust.map(c => ({
        type: 'Customer',
        date: c.createdAt,
        user: c.email,
        activity: 'New customer',
        details: c.name,
      })),
    ].sort((a,b)=> new Date(b.date) - new Date(a.date)).slice(0,10);

    // Email metrics optional
    let emailOpenClickDaily = [];
    if (EmailTracking) {
      const daily = await EmailTracking.aggregate([
        { $match: { createdAt: { $gte: start, $lte: end } } },
        { $project: { events: 1 } },
        { $unwind: '$events' },
        { $match: { 'events.timestamp': { $gte: start, $lte: end }, 'events.type': { $in: ['opened','clicked'] } } },
        { $group: { _id: { d: { $dateToString: { format: '%Y-%m-%d', date: '$events.timestamp' } }, type: '$events.type' }, count: { $sum: 1 } } },
        { $sort: { '_id.d': 1 } },
      ]);
      emailOpenClickDaily = daily;
    }

    res.json({ customerDaily, enquiriesDaily, leadStatus, activities, emailOpenClickDaily, range: { start, end } });
  } catch (err) { next(err); }
};
