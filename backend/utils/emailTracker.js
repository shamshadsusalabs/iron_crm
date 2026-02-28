const crypto = require('crypto');
const EmailTracking = require('../models/follow-up/EmailTracking');

// Generate unique tracking ID
function generateTrackingId() {
  return crypto.randomBytes(32).toString('hex');
}

// Add tracking pixel to email HTML
function addTrackingPixel(htmlContent, trackingId) {
  // Use production URL for tracking - Gmail needs to be able to access this
  const baseUrl = process.env.BASE_URL || process.env.BACKEND_URL || 'https://crmbackend-469714.el.r.appspot.com';

  // Enhanced tracking pixel with better HTML structure and meta tags
  const trackingPixel = `
    <img src="${baseUrl}/api/tracking/pixel/${trackingId}" 
         width="1" 
         height="1" 
         style="display:block!important;width:1px!important;height:1px!important;border:0!important;outline:0!important;position:absolute!important;left:-9999px!important;top:-9999px!important;opacity:0!important;" 
         alt="" 
         border="0" />`;

  // Ensure we have proper HTML structure with meta tags for better email client compatibility
  if (!htmlContent || htmlContent.trim() === '') {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
</head>
<body>
  ${trackingPixel}
</body>
</html>`;
  }

  // Try to add before closing body tag
  if (htmlContent.includes('</body>')) {
    return htmlContent.replace('</body>', `${trackingPixel}</body>`);
  }
  // Try to add before closing html tag
  else if (htmlContent.includes('</html>')) {
    return htmlContent.replace('</html>', `${trackingPixel}</html>`);
  }
  // If no proper HTML structure, wrap content and add pixel with proper meta tags
  else {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
</head>
<body>
  ${htmlContent}
  ${trackingPixel}
</body>
</html>`;
  }
}

// Convert links to tracking links
function addClickTracking(htmlContent, trackingId) {
  const baseUrl = process.env.BASE_URL || process.env.BACKEND_URL || 'https://crmbackend-469714.el.r.appspot.com';

  // Replace all href links with tracking links
  return htmlContent.replace(
    /href=["']([^"']+)["']/gi,
    (match, url) => {
      // Skip if already a tracking link or mailto/tel links
      if (url.includes('/api/tracking/click') || url.startsWith('mailto:') || url.startsWith('tel:')) {
        return match;
      }

      const trackingUrl = `${baseUrl}/api/tracking/click/${trackingId}?url=${encodeURIComponent(url)}`;
      return `href="${trackingUrl}"`;
    }
  );
}

// Create tracking record for email
async function createEmailTracking(emailId, campaignId, contactId) {
  try {
    const trackingId = generateTrackingId();

    const tracking = new EmailTracking({
      emailId,
      campaignId,
      contactId,
      trackingPixelId: trackingId,
      events: [] // Don't add 'sent' event here - it will be added when email is actually sent
    });

    await tracking.save();
    return trackingId;
  } catch (error) {
    console.error('Error creating email tracking:', error);
    throw error;
  }
}

// Add tracking to email content
function addEmailTracking(htmlContent, trackingId) {
  let trackedContent = htmlContent;

  // Add tracking pixel
  trackedContent = addTrackingPixel(trackedContent, trackingId);

  // Add click tracking to links
  trackedContent = addClickTracking(trackedContent, trackingId);

  return trackedContent;
}

// Record email event
async function recordEmailEvent(trackingId, eventType, eventData = {}) {
  try {
    const tracking = await EmailTracking.findOne({ trackingPixelId: trackingId });
    if (!tracking) {
      console.warn(`Tracking record not found for ID: ${trackingId}`);
      return;
    }

    // Check if event already exists (prevent duplicates for some events)
    const duplicateEvents = ['sent', 'delivered'];
    if (duplicateEvents.includes(eventType)) {
      const existingEvent = tracking.events.find(e => e.type === eventType);
      if (existingEvent) {
        return; // Skip duplicate
      }
    }

    tracking.events.push({
      type: eventType,
      timestamp: new Date(),
      data: new Map(Object.entries(eventData))
    });

    await tracking.save();
    return tracking;
  } catch (error) {
    console.error('Error recording email event:', error);
    throw error;
  }
}

module.exports = {
  generateTrackingId,
  addTrackingPixel,
  addClickTracking,
  createEmailTracking,
  addEmailTracking,
  recordEmailEvent
};
