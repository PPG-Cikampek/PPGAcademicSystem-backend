const mongoose = require('mongoose');

const Schema = mongoose.Schema;

/**
 * Bug Report Status Flow:
 * PENDING -> REVIEWING -> ACCEPTED/REJECTED
 * ACCEPTED -> FIXED (points awarded on FIXED)
 */
const BUG_REPORT_STATUSES = ['pending', 'reviewing', 'accepted', 'rejected', 'fixed'];
const SEVERITY_LEVELS = ['low', 'medium', 'high', 'critical'];
const CATEGORIES = ['ui', 'data', 'performance', 'security', 'other'];

// Schema for development updates (admin can add updates after acceptance)
const updateEntrySchema = new Schema({
    title: { type: String, required: true },
    description: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
}, { _id: true });

const bugReportSchema = new Schema({
    reportId: { type: String, required: true, unique: true }, // Format: BUG-XXXXXX
    userId: { type: mongoose.Types.ObjectId, required: true, ref: 'User' },
    
    // Report content
    title: { type: String, required: true, maxlength: 100 },
    description: { type: String, required: true, maxlength: 2000 },
    severity: { 
        type: String, 
        required: true, 
        enum: SEVERITY_LEVELS,
        lowercase: true 
    },
    category: { 
        type: String, 
        enum: CATEGORIES,
        lowercase: true,
        default: 'other'
    },
    screenshots: [{ type: String }], // Array of image paths (0-3 images)
    
    // Status workflow
    status: { 
        type: String, 
        required: true, 
        enum: BUG_REPORT_STATUSES,
        default: 'pending',
        lowercase: true
    },
    
    // Points - set by admin on acceptance, awarded on FIXED
    pointsAwarded: { type: Number, default: 0 },
    
    // Rejection details
    rejectionReason: { type: String },
    rejectionComment: { type: String },
    
    // Development updates (for accepted reports)
    updates: [updateEntrySchema],
    
    // Admin notes (internal)
    adminNotes: { type: String },
    
    // Timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Indexes for efficient queries
bugReportSchema.index({ userId: 1 });
bugReportSchema.index({ status: 1 });
bugReportSchema.index({ createdAt: -1 });
bugReportSchema.index({ severity: 1 });

// Update timestamp on save
bugReportSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Export constants for validation in controllers
module.exports = mongoose.model('BugReport', bugReportSchema);
module.exports.BUG_REPORT_STATUSES = BUG_REPORT_STATUSES;
module.exports.SEVERITY_LEVELS = SEVERITY_LEVELS;
module.exports.CATEGORIES = CATEGORIES;
