const mongoose = require('mongoose')
const MerchLead = require('../models/merch/Lead')
const MerchEvent = require('../models/merch/Event')
const CatalogItem = require('../models/catalog/CatalogItem')
const Template = require('../models/follow-up/Template')

function startOfMonth(d = new Date()) {
  const x = new Date(d)
  x.setDate(1)
  x.setHours(0, 0, 0, 0)
  return x
}
function monthsBack(n) {
  const x = new Date()
  x.setMonth(x.getMonth() - n)
  x.setDate(1)
  x.setHours(0, 0, 0, 0)
  return x
}

exports.summary = async (req, res, next) => {
  try {
    const userId = req.userId
    const createdByMatch = mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : null
    if (!createdByMatch) {
      return res.status(400).json({ message: 'Invalid merch user id' })
    }
    const today = new Date()

    const [leadsTotal, leadsByStatusAgg, leadsByPriorityAgg, eventsTotal, upcomingEvents, catalogsTotal, templatesTotal] = await Promise.all([
      MerchLead.countDocuments({ createdBy: createdByMatch }),
      MerchLead.aggregate([
        { $match: { createdBy: createdByMatch } },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]).catch(() => []),
      MerchLead.aggregate([
        { $match: { createdBy: createdByMatch } },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]).catch(() => []),
      MerchEvent.countDocuments({ createdBy: createdByMatch }),
      MerchEvent.countDocuments({ createdBy: createdByMatch, startAt: { $gte: today } }),
      CatalogItem.countDocuments({ createdBy: createdByMatch, createdByRole: 'merch' }).catch(() => 0),
      Template.countDocuments({ createdBy: createdByMatch, createdByRole: 'merch' }).catch(() => 0),
    ])

    const leadsByStatus = leadsByStatusAgg.reduce((acc, it) => { acc[it._id || 'Unknown'] = it.count; return acc }, {})
    const leadsByPriority = leadsByPriorityAgg.reduce((acc, it) => { acc[it._id || 'Unknown'] = it.count; return acc }, {})

    res.json({
      leads: { total: leadsTotal, byStatus: leadsByStatus, byPriority: leadsByPriority },
      events: { total: eventsTotal, upcoming: upcomingEvents },
      catalogs: { total: catalogsTotal },
      templates: { total: templatesTotal },
    })
  } catch (err) {
    console.error('merchDashboard.summary error', err)
    next(err)
  }
}

exports.timeseries = async (req, res, next) => {
  try {
    const userId = req.userId
    const createdByMatch = mongoose.isValidObjectId(userId) ? new mongoose.Types.ObjectId(userId) : null
    if (!createdByMatch) {
      return res.status(400).json({ message: 'Invalid merch user id' })
    }
    const endDate = new Date()
    const startDate = monthsBack(11)

    const [leadsMonthly, eventsMonthly] = await Promise.all([
      MerchLead.aggregate([
        { $match: { createdBy: createdByMatch, createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { '_id.y': 1, '_id.m': 1 } },
      ]).catch(() => []),
      MerchEvent.aggregate([
        { $match: { createdBy: createdByMatch, createdAt: { $gte: startDate, $lte: endDate } } },
        { $group: { _id: { y: { $year: '$createdAt' }, m: { $month: '$createdAt' } }, count: { $sum: 1 } } },
        { $sort: { '_id.y': 1, '_id.m': 1 } },
      ]).catch(() => []),
    ])

    res.json({ leadsMonthly, eventsMonthly })
  } catch (err) {
    console.error('merchDashboard.timeseries error', err)
    next(err)
  }
}
