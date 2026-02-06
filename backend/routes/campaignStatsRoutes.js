const express = require('express');
const router = express.Router();
const Campaign = require('../models/follow-up/Campaign');
const EmailTracking = require('../models/follow-up/EmailTracking');
const Email = require('../models/follow-up/Email');
const logger = require('../utils/logger');

// Recalculate stats for a specific campaign
router.post('/recalculate/:campaignId', async (req, res) => {
  try {
    const { campaignId } = req.params;
    
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    // Get all tracking records for this campaign
    const trackingRecords = await EmailTracking.find({ campaignId });
    
    // Get actual sent email count from Email collection
    const sentEmailsCount = await Email.countDocuments({ 
      campaignId, 
      status: { $in: ['sent', 'delivered'] } 
    });
    
    // Calculate stats
    const stats = {
      totalSent: sentEmailsCount,
      delivered: 0,
      opened: 0,
      clicked: 0,
      bounced: 0,
      unsubscribed: 0
    };

    trackingRecords.forEach(tracking => {
      const events = tracking.events || [];
      
      // Count unique events per tracking record
      const hasOpened = events.some(e => e.type === 'opened');
      const hasClicked = events.some(e => e.type === 'clicked');
      const hasBounced = events.some(e => e.type === 'bounced');
      const hasUnsubscribed = events.some(e => e.type === 'unsubscribed');
      const hasDelivered = events.some(e => e.type === 'delivered');

      if (hasDelivered) stats.delivered++;
      if (hasOpened) stats.opened++;
      if (hasClicked) stats.clicked++;
      if (hasBounced) stats.bounced++;
      if (hasUnsubscribed) stats.unsubscribed++;
    });

    // Update campaign with recalculated stats
    campaign.stats = stats;
    await campaign.save();

    logger.info(`Stats recalculated for campaign ${campaignId}:`, stats);

    res.json({
      success: true,
      message: 'Campaign stats recalculated successfully',
      stats
    });

  } catch (error) {
    logger.error('Error recalculating campaign stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to recalculate stats',
      error: error.message
    });
  }
});

// Recalculate stats for all campaigns
router.post('/recalculate-all', async (req, res) => {
  try {
    const campaigns = await Campaign.find({});
    const results = [];

    for (const campaign of campaigns) {
      try {
        const trackingRecords = await EmailTracking.find({ campaignId: campaign._id });
        
        // Get actual sent email count from Email collection
        const sentEmailsCount = await Email.countDocuments({ 
          campaignId: campaign._id, 
          status: { $in: ['sent', 'delivered'] } 
        });
        
        const stats = {
          totalSent: sentEmailsCount,
          delivered: 0,
          opened: 0,
          clicked: 0,
          bounced: 0,
          unsubscribed: 0
        };

        trackingRecords.forEach(tracking => {
          const events = tracking.events || [];
          
          const hasOpened = events.some(e => e.type === 'opened');
          const hasBounced = events.some(e => e.type === 'bounced');
          const hasUnsubscribed = events.some(e => e.type === 'unsubscribed');
          const hasDelivered = events.some(e => e.type === 'delivered');

          if (hasDelivered) stats.delivered++;
          if (hasOpened) stats.opened++;
          if (hasBounced) stats.bounced++;
          if (hasUnsubscribed) stats.unsubscribed++;
        });

        campaign.stats = stats;
        await campaign.save();

        results.push({
          campaignId: campaign._id,
          name: campaign.name,
          stats
        });

      } catch (error) {
        logger.error(`Error recalculating stats for campaign ${campaign._id}:`, error);
        results.push({
          campaignId: campaign._id,
          name: campaign.name,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Recalculated stats for ${campaigns.length} campaigns`,
      results
    });

  } catch (error) {
    logger.error('Error recalculating all campaign stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to recalculate all stats',
      error: error.message
    });
  }
});

module.exports = router;
