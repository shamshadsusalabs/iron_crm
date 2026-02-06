const express = require('express');
const router = express.Router();
const EmailTracking = require('../models/follow-up/EmailTracking');
const Campaign = require('../models/follow-up/Campaign');
const logger = require('../utils/logger');

// Track email opens via pixel
router.get('/pixel/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'] || '';

    // Filter out server-side requests and bots
    const botPatterns = [
      /bot/i, /crawler/i, /spider/i, /scanner/i, /preview/i,
      /curl/i, /wget/i, /postman/i, /insomnia/i, /httpie/i,
      /node/i, /axios/i, /fetch/i, /request/i
    ];
    
    const isBot = botPatterns.some(pattern => pattern.test(userAgent));
    const isServerRequest = !userAgent || userAgent.includes('node') || ipAddress === '127.0.0.1' || ipAddress === '::1';
    
    console.log(`🔍 TRACKING PIXEL REQUEST - TrackingID: ${trackingId}, UserAgent: ${userAgent}, IP: ${ipAddress}, IsBot: ${isBot}, IsServer: ${isServerRequest}`);

    // Find tracking record
    const tracking = await EmailTracking.findOne({ trackingPixelId: trackingId });
    
    if (tracking) {
      // Check if already opened
      const alreadyOpened = tracking.events.some(event => event.type === 'opened');
      
      if (!alreadyOpened) {
        // Add open event
        console.log(`✅ TRACKING OPEN EVENT - TrackingID: ${trackingId}, Contact: ${tracking.contactId}, Campaign: ${tracking.campaignId}`);
        tracking.events.push({
          type: 'opened',
          timestamp: new Date(),
          data: new Map([
            ['ipAddress', ipAddress],
            ['userAgent', userAgent]
          ])
        });
        
        tracking.ipAddress = ipAddress;
        tracking.userAgent = userAgent;
        
        await tracking.save();

        // Update campaign stats
        await Campaign.findByIdAndUpdate(tracking.campaignId, {
          $inc: { 'stats.opened': 1 }
        });

        console.log(`📊 CAMPAIGN STATS UPDATED - Campaign: ${tracking.campaignId}, Opened count incremented`);
        logger.info(`Email opened: ${trackingId}`);
      }
    }

    // Return 1x1 transparent pixel
    const pixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
      'base64'
    );
    
    res.set({
      'Content-Type': 'image/png',
      'Content-Length': pixel.length,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    
    res.send(pixel);
  } catch (error) {
    logger.error('Error tracking email open:', error);
    res.status(500).send('Error');
  }
});

// Track link clicks
router.get('/click/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    const { url } = req.query;
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.headers['user-agent'];

    console.log(`🔗 CLICK TRACKING REQUEST - TrackingID: ${trackingId}, URL: ${url}, UserAgent: ${userAgent}, IP: ${ipAddress}`);

    // Filter out server-side requests and bots (same as pixel tracking)
    const botPatterns = [
      /bot/i, /crawler/i, /spider/i, /scanner/i, /preview/i,
      /curl/i, /wget/i, /postman/i, /insomnia/i, /httpie/i,
      /node/i, /axios/i, /fetch/i, /request/i
    ];
    
    const isBot = botPatterns.some(pattern => pattern.test(userAgent));
    const isServerRequest = !userAgent || userAgent.includes('node') || ipAddress === '127.0.0.1' || ipAddress === '::1';
    
    // Find tracking record
    const tracking = await EmailTracking.findOne({ trackingPixelId: trackingId });
    
    if (tracking && !isBot && !isServerRequest) {
      console.log(`✅ LEGITIMATE CLICK - Recording click event for ${trackingId}`);
      
      // Add click event
      tracking.events.push({
        type: 'clicked',
        timestamp: new Date(),
        data: new Map([
          ['url', url],
          ['ipAddress', ipAddress],
          ['userAgent', userAgent]
        ])
      });
      
      await tracking.save();

      // Update campaign stats
      await Campaign.findByIdAndUpdate(tracking.campaignId, {
        $inc: { 'stats.clicked': 1 }
      });

      logger.info(`Email link clicked: ${trackingId}, URL: ${url}`);
    } else if (isBot || isServerRequest) {
      console.log(`⚠️ BOT/SERVER CLICK DETECTED - Skipping tracking for: ${userAgent}, IP: ${ipAddress}`);
    }

    // Redirect to original URL
    if (url) {
      res.redirect(decodeURIComponent(url));
    } else {
      res.status(400).send('Missing URL parameter');
    }
  } catch (error) {
    logger.error('Error tracking email click:', error);
    res.status(500).send('Error');
  }
});

// Get tracking details for a campaign
router.get('/campaign/:campaignId/details', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const Contact = require('../models/follow-up/Contact');
    const Email = require('../models/follow-up/Email');
    
    const trackingData = await EmailTracking.find({ campaignId })
      .populate('contactId', 'email firstName lastName')
      .populate('emailId', 'subject sentAt contactId')
      .sort({ createdAt: -1 });

    const detailedStats = await Promise.all(trackingData.map(async (tracking) => {
      const events = tracking.events.reduce((acc, event) => {
        acc[event.type] = {
          timestamp: event.timestamp,
          data: Object.fromEntries(event.data || new Map())
        };
        return acc;
      }, {});

      // Try to get contact info from multiple sources
      let contactInfo = {
        email: 'Unknown',
        name: 'Unknown'
      };

      // First try: populated contactId
      if (tracking.contactId) {
        contactInfo.email = tracking.contactId.email || 'Unknown';
        contactInfo.name = tracking.contactId ? 
          `${tracking.contactId.firstName || ''} ${tracking.contactId.lastName || ''}`.trim() || 'Unknown' : 
          'Unknown';
      }
      // Second try: get contact from emailId if contactId is missing
      else if (tracking.emailId?.contactId) {
        try {
          const contact = await Contact.findById(tracking.emailId.contactId);
          if (contact) {
            contactInfo.email = contact.email || 'Unknown';
            contactInfo.name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown';
          }
        } catch (error) {
          console.log('Error fetching contact from email:', error);
        }
      }
      // Third try: get contact from Email record
      else if (tracking.emailId) {
        try {
          const email = await Email.findById(tracking.emailId._id).populate('contactId');
          if (email?.contactId) {
            contactInfo.email = email.contactId.email || 'Unknown';
            contactInfo.name = `${email.contactId.firstName || ''} ${email.contactId.lastName || ''}`.trim() || 'Unknown';
          }
        } catch (error) {
          console.log('Error fetching contact from email record:', error);
        }
      }

      return {
        trackingId: tracking.trackingPixelId,
        contact: contactInfo,
        email: {
          subject: tracking.emailId?.subject,
          sentAt: tracking.emailId?.sentAt
        },
        events,
        status: {
          opened: !!events.opened,
          clicked: !!events.clicked,
          bounced: !!events.bounced
        },
        lastActivity: tracking.events.length > 0 ? 
          tracking.events[tracking.events.length - 1].timestamp : null,
        ipAddress: tracking.ipAddress,
        userAgent: tracking.userAgent
      };
    }));

    res.json({
      success: true,
      data: detailedStats,
      summary: {
        total: trackingData.length,
        opened: trackingData.filter(t => t.events.some(e => e.type === 'opened')).length,
        clicked: trackingData.filter(t => t.events.some(e => e.type === 'clicked')).length,
      }
    });
  } catch (error) {
    logger.error('Error fetching tracking details:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch tracking details' });
  }
});

// Get tracking stats for a campaign
router.get('/campaign/:campaignId/stats', async (req, res) => {
  try {
    const { campaignId } = req.params;
    const Email = require('../models/follow-up/Email');
    
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ success: false, message: 'Campaign not found' });
    }

    // Get actual sent email count from Email collection
    const sentEmailsCount = await Email.countDocuments({ 
      campaignId, 
      status: { $in: ['sent', 'delivered'] } 
    });

    const trackingData = await EmailTracking.find({ campaignId });
    
    const stats = {
      totalSent: sentEmailsCount, // Use actual sent emails count
      opened: trackingData.filter(t => t.events.some(e => e.type === 'opened')).length,
      clicked: trackingData.filter(t => t.events.some(e => e.type === 'clicked')).length,
      bounced: trackingData.filter(t => t.events.some(e => e.type === 'bounced')).length,
      openRate: sentEmailsCount > 0 ? 
        Math.round((trackingData.filter(t => t.events.some(e => e.type === 'opened')).length / sentEmailsCount) * 100) : 0,
      clickRate: sentEmailsCount > 0 ? 
        Math.round((trackingData.filter(t => t.events.some(e => e.type === 'clicked')).length / sentEmailsCount) * 100) : 0
    };

    res.json({ success: true, stats });
  } catch (error) {
    logger.error('Error fetching campaign stats:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch stats' });
  }
});



module.exports = router;
