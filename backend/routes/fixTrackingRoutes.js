const express = require('express');
const router = express.Router();
const EmailTracking = require('../models/follow-up/EmailTracking');
const Campaign = require('../models/follow-up/Campaign');
const logger = require('../utils/logger');

// Fix tracking records where click exists but open doesn't
router.post('/fix-missing-opens', async (req, res) => {
  try {
    // Find all tracking records that have clicks but no opens
    const trackingRecords = await EmailTracking.find({});
    
    let fixedCount = 0;
    let campaignUpdates = new Map();

    for (const tracking of trackingRecords) {
      const hasClicked = tracking.events.some(e => e.type === 'clicked');
      const hasOpened = tracking.events.some(e => e.type === 'opened');
      
      if (hasClicked && !hasOpened) {
        // Find the first click event to use its timestamp
        const firstClick = tracking.events.find(e => e.type === 'clicked');
        
        // Add open event just before the click
        const openTimestamp = new Date(firstClick.timestamp.getTime() - 1000); // 1 second before click
        
        tracking.events.push({
          type: 'opened',
          timestamp: openTimestamp,
          data: new Map([
            ['source', 'inferred_from_click'],
            ['ipAddress', firstClick.data.get('ipAddress') || 'unknown'],
            ['userAgent', firstClick.data.get('userAgent') || 'unknown']
          ])
        });
        
        // Sort events by timestamp
        tracking.events.sort((a, b) => a.timestamp - b.timestamp);
        
        await tracking.save();
        fixedCount++;
        
        // Track campaign updates
        const campaignId = tracking.campaignId.toString();
        campaignUpdates.set(campaignId, (campaignUpdates.get(campaignId) || 0) + 1);
        
        logger.info(`Fixed missing open for tracking ${tracking.trackingPixelId}`);
      }
    }
    
    // Update campaign stats
    for (const [campaignId, openCount] of campaignUpdates) {
      await Campaign.findByIdAndUpdate(campaignId, {
        $inc: { 'stats.opened': openCount }
      });
    }
    
    res.json({
      success: true,
      message: `Fixed ${fixedCount} tracking records with missing opens`,
      fixedCount,
      campaignsUpdated: campaignUpdates.size
    });

  } catch (error) {
    logger.error('Error fixing missing opens:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fix missing opens',
      error: error.message
    });
  }
});

module.exports = router;
