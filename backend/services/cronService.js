const cron = require('node-cron')
const followupService = require('./followupService')
const sequenceService = require('./sequenceService')
const logger = require('../utils/logger')

// Process scheduled followups every 5 minutes
const followupJob = cron.schedule('*/5 * * * *', async () => {
  try {
    logger.info('Starting scheduled followup processing...')
    await followupService.processScheduledFollowups()
    logger.info('Scheduled followup processing completed')
  } catch (error) {
    logger.error('Error processing scheduled followups:', error)
  }
}, {
  scheduled: false, // Don't start automatically
  timezone: 'Asia/Kolkata'
})

// Process scheduled campaigns every minute
const campaignJob = cron.schedule('* * * * *', async () => {
  try {
    logger.info('Starting scheduled campaign processing...')
    await followupService.processScheduledCampaigns()
    logger.info('Scheduled campaign processing completed')
  } catch (error) {
    logger.error('Error processing scheduled campaigns:', error)
  }
}, {
  scheduled: false,
  timezone: 'Asia/Kolkata'
})

// Process due queued emails (sequence items) every minute
const emailJob = cron.schedule('* * * * *', async () => {
  try {
    logger.info('Starting due email processing...')
    await followupService.processDueEmails()
    logger.info('Due email processing completed')
  } catch (error) {
    logger.error('Error processing due emails:', error)
  }
}, {
  scheduled: false,
  timezone: 'Asia/Kolkata'
})

// ENHANCED: Process sequence completion and repeat logic
const sequenceCompletionJob = cron.schedule('*/10 * * * *', async () => {
  logger.info(' Starting sequence completion check...')
  try {
    await sequenceService.processSequenceCompletion()
    logger.info(' Sequence completion check completed')
  } catch (error) {
    logger.error(' Error in sequence completion job:', error)
  }
}, {
  scheduled: false, // Don't start automatically
  timezone: 'Asia/Kolkata'
})

// Start the cron job
function startCronJobs() {
  try {
    followupJob.start()
    logger.info('Followup cron job started')

    campaignJob.start()
    logger.info('Campaign cron job started')

    emailJob.start()
    logger.info('Email processing cron job started')
    
    sequenceCompletionJob.start()
    logger.info('Sequence completion cron job started')

    logger.info('All cron jobs started successfully')
  } catch (error) {
    logger.error('Error starting cron jobs:', error)
  }
}

// Stop the cron job
function stopCronJobs() {
  followupJob.stop()
  campaignJob.stop()
  emailJob.stop()
  sequenceCompletionJob.stop()
  logger.info('All cron jobs stopped')
}

module.exports = {
  startCronJobs,
  stopCronJobs
}