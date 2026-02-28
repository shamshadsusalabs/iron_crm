const mongoose = require('mongoose');
const path = require('path');
const dotenv = require('dotenv');

// Load env vars
dotenv.config({ path: path.join(__dirname, '../.env') });

const followupService = require('../services/followupService');
const { connectDB } = require('../config/db');

async function run() {
    try {
        console.log('Connecting to DB...');
        await connectDB();
        console.log('Connected. Starting sync...');

        // Sync all contact lists
        const result = await followupService.syncContactListCounts();
        console.log('Sync result:', result);

    } catch (err) {
        console.error('Sync failed:', err);
    } finally {
        try {
            await mongoose.disconnect();
            console.log('Disconnected from DB.');
        } catch (e) {
            console.error('Error disconnecting:', e);
        }
        process.exit(0);
    }
}

run();
