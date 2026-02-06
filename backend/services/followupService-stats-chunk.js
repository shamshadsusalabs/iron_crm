
async function getContactStats(userId) {
    try {
        const query = { userId }

        // Run multiple counts in parallel for performance
        const [total, active, unsubscribed, bounced, complained, withProducts] = await Promise.all([
            Contact.countDocuments(query),
            Contact.countDocuments({ ...query, status: 'active' }),
            Contact.countDocuments({ ...query, status: 'unsubscribed' }),
            Contact.countDocuments({ ...query, status: 'bounced' }),
            Contact.countDocuments({ ...query, status: 'complained' }),
            Contact.countDocuments({ ...query, interestedProducts: { $exists: true, $not: { $size: 0 } } })
        ])

        return {
            total,
            active,
            unsubscribed,
            bounced,
            complained,
            withProducts
        }
    } catch (error) {
        logger.error("Error fetching contact stats:", error)
        throw error
    }
}
