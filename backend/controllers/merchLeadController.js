const Lead = require('../models/merch/Lead')
const logger = require('../utils/logger')

// Create Lead
async function createLead(req, res) {
  try {
    const userId = req.userId
    const { customer, email = '', status = 'Follow-up', priority = 'Medium', lastContact, nextAction, notes = '', interestedProducts = [] } = req.body
    if (!customer) return res.status(400).json({ success: false, message: 'customer is required' })
    if (!email) return res.status(400).json({ success: false, message: 'email is required' })

    // Check for existing lead with same email for this user
    if (email) {
      const existingLead = await Lead.findOne({ email, createdBy: userId })
      if (existingLead) {
        return res.status(400).json({ success: false, message: 'Lead with this email already exists' })
      }
    }

    const lead = await Lead.create({
      customer,
      email,
      status,
      priority,
      lastContact: lastContact ? new Date(lastContact) : null,
      nextAction: nextAction ? new Date(nextAction) : null,
      notes,
      interestedProducts,
      createdBy: userId,
    })

    return res.status(201).json({ success: true, data: lead })
  } catch (error) {
    logger.error('Error creating lead:', error)
    return res.status(500).json({ success: false, message: 'Failed to create lead', error: error.message })
  }
}

// List Leads (with filters + pagination)
async function listLeads(req, res) {
  try {
    const userId = req.userId
    const { page = 1, limit = 10, search = '', status = '', priority = '', product = '', startDate = '', endDate = '' } = req.query

    const query = { createdBy: userId }
    if (search) {
      query.$or = [
        { customer: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ]
    }
    // status can be a single value, CSV string, or array
    if (status) {
      let statuses = status
      if (Array.isArray(statuses)) {
        // already an array
      } else if (typeof statuses === 'string') {
        statuses = statuses.split(',').map((s) => s.trim()).filter(Boolean)
      } else {
        statuses = []
      }
      if (Array.isArray(statuses) && statuses.length > 0) {
        if (statuses.length === 1) query.status = statuses[0]
        else query.status = { $in: statuses }
      }
    }
    // priority can be a single value, CSV string, or array
    if (priority) {
      let priorities = priority
      if (Array.isArray(priorities)) {
        // already an array
      } else if (typeof priorities === 'string') {
        priorities = priorities.split(',').map((s) => s.trim()).filter(Boolean)
      } else {
        priorities = []
      }
      if (Array.isArray(priorities) && priorities.length > 0) {
        if (priorities.length === 1) query.priority = priorities[0]
        else query.priority = { $in: priorities }
      }
    }
    // product filter (interestedProducts)
    if (product) {
      const products = product.split(',').map(s => s.trim()).filter(Boolean)
      if (products.length > 0) query.interestedProducts = { $in: products }
    }
    if (startDate || endDate) {
      query.lastContact = {}
      if (startDate) query.lastContact.$gte = new Date(startDate)
      if (endDate) query.lastContact.$lte = new Date(endDate)
    }

    const leads = await Lead.find(query)
      .sort({ updatedAt: -1 })
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit))

    const total = await Lead.countDocuments(query)

    return res.json({
      success: true,
      data: leads,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    })
  } catch (error) {
    logger.error('Error listing leads:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch leads', error: error.message })
  }
}

// Get Lead by id
async function getLeadById(req, res) {
  try {
    const userId = req.userId
    const { id } = req.params
    const lead = await Lead.findOne({ _id: id, createdBy: userId })
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' })
    return res.json({ success: true, data: lead })
  } catch (error) {
    logger.error('Error fetching lead:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch lead', error: error.message })
  }
}

// Update Lead
async function updateLead(req, res) {
  try {
    const userId = req.userId
    const { id } = req.params
    const update = { ...req.body }
    if (update.lastContact) update.lastContact = new Date(update.lastContact)
    if (update.nextAction) update.nextAction = new Date(update.nextAction)

    const lead = await Lead.findOneAndUpdate({ _id: id, createdBy: userId }, update, { new: true, runValidators: true })
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' })
    return res.json({ success: true, data: lead })
  } catch (error) {
    logger.error('Error updating lead:', error)
    return res.status(500).json({ success: false, message: 'Failed to update lead', error: error.message })
  }
}

// Delete Lead
async function deleteLead(req, res) {
  try {
    const userId = req.userId
    const { id } = req.params
    const lead = await Lead.findOneAndDelete({ _id: id, createdBy: userId })
    if (!lead) return res.status(404).json({ success: false, message: 'Lead not found' })
    return res.json({ success: true, message: 'Lead deleted' })
  } catch (error) {
    logger.error('Error deleting lead:', error)
    return res.status(500).json({ success: false, message: 'Failed to delete lead', error: error.message })
  }
}

// Get filtered emails only (lightweight - for bulk compose)
async function getFilteredEmails(req, res) {
  try {
    const userId = req.userId
    const { status, priority, product, search } = req.query
    const MAX_EMAILS = 5000

    const query = { createdBy: userId, email: { $ne: '' } }

    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean)
      if (statuses.length === 1) query.status = statuses[0]
      else if (statuses.length > 1) query.status = { $in: statuses }
    }

    if (priority) {
      const priorities = priority.split(',').map(s => s.trim()).filter(Boolean)
      if (priorities.length === 1) query.priority = priorities[0]
      else if (priorities.length > 1) query.priority = { $in: priorities }
    }

    if (product) {
      const products = product.split(',').map(s => s.trim()).filter(Boolean)
      query.interestedProducts = { $in: products }
    }

    if (search) {
      // If user provided a search term, filter leads by matching customer OR email
      query.$or = [
        { customer: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } }
      ]
    }

    const leads = await Lead.find(query).select('email').limit(MAX_EMAILS).lean()
    const emails = leads.map(l => l.email).filter(Boolean)
    const total = await Lead.countDocuments(query)

    return res.json({ success: true, emails, total, capped: total > MAX_EMAILS })
  } catch (error) {
    logger.error('Error fetching filtered emails:', error)
    return res.status(500).json({ success: false, message: 'Failed to fetch emails', error: error.message })
  }
}

module.exports = {
  createLead,
  listLeads,
  getLeadById,
  updateLead,
  deleteLead,
  getFilteredEmails,
}
