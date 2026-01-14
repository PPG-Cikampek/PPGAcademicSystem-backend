const HttpError = require("../models/http-error");
const mongoose = require("mongoose");

const BugReport = require("../models/bugReport");
const ReportIdCounter = require("../models/reportIdCounter");
const User = require("../models/user");

const { BUG_REPORT_STATUSES, SEVERITY_LEVELS, CATEGORIES } = BugReport;

// Valid status transitions
const VALID_TRANSITIONS = {
    pending: ['reviewing', 'rejected'],
    reviewing: ['accepted', 'rejected'],
    accepted: ['fixed'],
    rejected: [],
    fixed: []
};

/**
 * Get bug reports with filters
 * Admin: can see all reports
 * User: can only see their own reports
 * GET /api/bugReports
 */
const getBugReports = async (req, res, next) => {
    const {
        status,
        severity,
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortDir = 'desc',
        search
    } = req.query;

    const userId = req.userData.userId;
    const userRole = req.userData.userRole;
    const isAdmin = userRole === 'admin';

    try {
        const pageNumber = Math.max(parseInt(page, 10) || 1, 1);
        const pageSize = Math.max(parseInt(limit, 10) || 10, 1);

        // Build match stage
        const matchStage = {};
        
        // Non-admin users can only see their own reports
        if (!isAdmin) {
            matchStage.userId = new mongoose.Types.ObjectId(userId);
        }
        
        if (status && BUG_REPORT_STATUSES.includes(status.toLowerCase())) {
            matchStage.status = status.toLowerCase();
        }
        
        if (severity && SEVERITY_LEVELS.includes(severity.toLowerCase())) {
            matchStage.severity = severity.toLowerCase();
        }

        if (search) {
            const searchRegex = new RegExp(search, 'i');
            matchStage.$or = [
                { title: { $regex: searchRegex } },
                { reportId: { $regex: searchRegex } },
                { description: { $regex: searchRegex } }
            ];
        }

        // Sort configuration
        const sortFieldMap = {
            createdAt: 'createdAt',
            updatedAt: 'updatedAt',
            severity: 'severity',
            status: 'status',
            title: 'title'
        };
        const resolvedSortField = sortFieldMap[sortBy] || 'createdAt';
        const resolvedSortDir = sortDir === 'asc' ? 1 : -1;

        // Aggregation pipeline
        const basePipeline = [
            { $match: matchStage },
            {
                $lookup: {
                    from: 'users',
                    localField: 'userId',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    reporterName: '$user.name',
                    reporterEmail: '$user.email'
                }
            }
        ];

        const dataPipeline = [
            ...basePipeline,
            { $sort: { [resolvedSortField]: resolvedSortDir, _id: 1 } },
            { $skip: (pageNumber - 1) * pageSize },
            { $limit: pageSize },
            {
                $project: {
                    'user.password': 0,
                    'user.resetToken': 0,
                    'user.resetTokenExpiration': 0
                }
            }
        ];

        const [data, countResult] = await Promise.all([
            BugReport.aggregate(dataPipeline),
            BugReport.aggregate([...basePipeline, { $count: 'total' }])
        ]);

        const total = countResult[0]?.total || 0;
        const totalPages = Math.ceil(total / pageSize) || 1;

        const reports = data.map((doc) => ({
            ...doc,
            id: doc._id
        }));

        return res.json({
            bugReports: reports,
            page: pageNumber,
            limit: pageSize,
            total,
            totalPages,
            hasNext: pageNumber < totalPages,
            hasPrev: pageNumber > 1
        });
    } catch (err) {
        console.error('getBugReports error:', err);
        return next(new HttpError('Gagal memuat laporan bug!', 500));
    }
};

/**
 * Get single bug report by reportId
 * GET /api/bugReports/:reportId
 */
const getBugReportById = async (req, res, next) => {
    const { reportId } = req.params;
    const userId = req.userData.userId;
    const userRole = req.userData.userRole;
    const isAdmin = userRole === 'admin';

    try {
        const report = await BugReport.findOne({ reportId })
            .populate('userId', 'name email image contributionPoints');

        if (!report) {
            return next(new HttpError('Laporan bug tidak ditemukan!', 404));
        }

        // Non-admin can only view their own reports
        if (!isAdmin && report.userId._id.toString() !== userId) {
            return next(new HttpError('Anda tidak memiliki akses ke laporan ini!', 403));
        }

        return res.json({
            bugReport: {
                ...report.toObject(),
                id: report._id,
                reporterName: report.userId?.name,
                reporterEmail: report.userId?.email
            }
        });
    } catch (err) {
        console.error('getBugReportById error:', err);
        return next(new HttpError('Gagal memuat detail laporan bug!', 500));
    }
};

/**
 * Create new bug report
 * POST /api/bugReports
 */
const createBugReport = async (req, res, next) => {
    const { title, description, severity, category } = req.body;
    const userId = req.userData.userId;

    // Validate required fields
    if (!title || !description || !severity) {
        return next(new HttpError('Judul, deskripsi, dan tingkat keparahan wajib diisi!', 400));
    }

    if (!SEVERITY_LEVELS.includes(severity.toLowerCase())) {
        return next(new HttpError('Tingkat keparahan tidak valid!', 400));
    }

    if (category && !CATEGORIES.includes(category.toLowerCase())) {
        return next(new HttpError('Kategori tidak valid!', 400));
    }

    try {
        // Generate unique report ID
        const reportId = await ReportIdCounter.getNextReportId();

        // Handle screenshot uploads (from multer)
        const screenshots = [];
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                screenshots.push(file.path);
            }
        }

        const newReport = new BugReport({
            reportId,
            userId,
            title: title.trim(),
            description: description.trim(),
            severity: severity.toLowerCase(),
            category: category ? category.toLowerCase() : 'other',
            screenshots,
            status: 'pending',
            pointsAwarded: 0
        });

        await newReport.save();

        return res.status(201).json({
            message: 'Laporan bug berhasil dikirim!',
            bugReport: {
                ...newReport.toObject(),
                id: newReport._id
            }
        });
    } catch (err) {
        console.error('createBugReport error:', err);
        return next(new HttpError('Gagal mengirim laporan bug!', 500));
    }
};

/**
 * Update bug report status (Admin only)
 * PATCH /api/bugReports/:reportId/status
 */
const updateBugReportStatus = async (req, res, next) => {
    const { reportId } = req.params;
    const { 
        status: newStatus, 
        pointsAwarded, 
        rejectionReason, 
        rejectionComment,
        adminNotes 
    } = req.body;
    const userRole = req.userData.userRole;

    // Admin-only check
    if (userRole !== 'admin') {
        return next(new HttpError('Hanya admin yang dapat mengubah status laporan!', 403));
    }

    if (!newStatus || !BUG_REPORT_STATUSES.includes(newStatus.toLowerCase())) {
        return next(new HttpError('Status tidak valid!', 400));
    }

    try {
        const report = await BugReport.findOne({ reportId });

        if (!report) {
            return next(new HttpError('Laporan bug tidak ditemukan!', 404));
        }

        const currentStatus = report.status;
        const targetStatus = newStatus.toLowerCase();

        // Validate status transition
        if (!VALID_TRANSITIONS[currentStatus].includes(targetStatus)) {
            return next(new HttpError(
                `Tidak dapat mengubah status dari "${currentStatus}" ke "${targetStatus}"!`,
                400
            ));
        }

        // Update report fields
        report.status = targetStatus;
        
        if (adminNotes !== undefined) {
            report.adminNotes = adminNotes;
        }

        // Handle acceptance - set points (but don't award yet)
        if (targetStatus === 'accepted') {
            if (pointsAwarded !== undefined && pointsAwarded >= 0) {
                report.pointsAwarded = pointsAwarded;
            }
        }

        // Handle rejection - require reason
        if (targetStatus === 'rejected') {
            if (!rejectionReason) {
                return next(new HttpError('Alasan penolakan wajib diisi!', 400));
            }
            report.rejectionReason = rejectionReason;
            report.rejectionComment = rejectionComment || '';
            report.pointsAwarded = 0;
        }

        // Handle FIXED - award points to user
        if (targetStatus === 'fixed' && report.pointsAwarded > 0) {
            await User.findByIdAndUpdate(
                report.userId,
                { $inc: { contributionPoints: report.pointsAwarded } }
            );
        }

        await report.save();

        return res.json({
            message: `Status laporan berhasil diubah ke "${targetStatus}"!`,
            bugReport: {
                ...report.toObject(),
                id: report._id
            }
        });
    } catch (err) {
        console.error('updateBugReportStatus error:', err);
        return next(new HttpError('Gagal mengubah status laporan!', 500));
    }
};

/**
 * Add development update to accepted bug report (Admin only)
 * POST /api/bugReports/:reportId/updates
 */
const addBugReportUpdate = async (req, res, next) => {
    const { reportId } = req.params;
    const { title, description } = req.body;
    const userRole = req.userData.userRole;

    // Admin-only check
    if (userRole !== 'admin') {
        return next(new HttpError('Hanya admin yang dapat menambahkan update!', 403));
    }

    if (!title || !description) {
        return next(new HttpError('Judul dan deskripsi update wajib diisi!', 400));
    }

    try {
        const report = await BugReport.findOne({ reportId });

        if (!report) {
            return next(new HttpError('Laporan bug tidak ditemukan!', 404));
        }

        // Can only add updates to accepted or fixed reports
        if (!['accepted', 'fixed'].includes(report.status)) {
            return next(new HttpError('Update hanya dapat ditambahkan ke laporan yang diterima!', 400));
        }

        report.updates.push({
            title: title.trim(),
            description: description.trim(),
            createdAt: new Date()
        });

        await report.save();

        return res.json({
            message: 'Update berhasil ditambahkan!',
            bugReport: {
                ...report.toObject(),
                id: report._id
            }
        });
    } catch (err) {
        console.error('addBugReportUpdate error:', err);
        return next(new HttpError('Gagal menambahkan update!', 500));
    }
};

/**
 * Delete bug report (Owner only, pending status only)
 * DELETE /api/bugReports/:reportId
 */
const deleteBugReport = async (req, res, next) => {
    const { reportId } = req.params;
    const userId = req.userData.userId;
    const userRole = req.userData.userRole;

    try {
        const report = await BugReport.findOne({ reportId });

        if (!report) {
            return next(new HttpError('Laporan bug tidak ditemukan!', 404));
        }

        // Only owner or admin can delete
        const isOwner = report.userId.toString() === userId;
        const isAdmin = userRole === 'admin';

        if (!isOwner && !isAdmin) {
            return next(new HttpError('Anda tidak memiliki akses untuk menghapus laporan ini!', 403));
        }

        // Non-admin can only delete pending reports
        if (!isAdmin && report.status !== 'pending') {
            return next(new HttpError('Hanya laporan dengan status "pending" yang dapat dihapus!', 400));
        }

        await BugReport.deleteOne({ reportId });

        return res.json({
            message: 'Laporan bug berhasil dihapus!'
        });
    } catch (err) {
        console.error('deleteBugReport error:', err);
        return next(new HttpError('Gagal menghapus laporan bug!', 500));
    }
};

/**
 * Get leaderboard - aggregated user contribution points
 * GET /api/bugReports/leaderboard
 */
const getLeaderboard = async (req, res, next) => {
    const { period = 'all', limit = 20 } = req.query;
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

    try {
        // Build date filter for period
        let dateFilter = {};
        const now = new Date();
        
        if (period === 'week') {
            const weekAgo = new Date(now);
            weekAgo.setDate(weekAgo.getDate() - 7);
            dateFilter = { createdAt: { $gte: weekAgo } };
        } else if (period === 'month') {
            const monthAgo = new Date(now);
            monthAgo.setMonth(monthAgo.getMonth() - 1);
            dateFilter = { createdAt: { $gte: monthAgo } };
        }

        // Aggregate bug reports by user
        const leaderboard = await BugReport.aggregate([
            { $match: { status: 'fixed', ...dateFilter } },
            {
                $group: {
                    _id: '$userId',
                    totalPoints: { $sum: '$pointsAwarded' },
                    reportsFixed: { $sum: 1 },
                    lastContribution: { $max: '$updatedAt' }
                }
            },
            {
                $lookup: {
                    from: 'users',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user'
                }
            },
            { $unwind: '$user' },
            {
                $project: {
                    userId: '$_id',
                    userName: '$user.name',
                    userEmail: '$user.email',
                    userImage: '$user.image',
                    totalPoints: 1,
                    reportsFixed: 1,
                    lastContribution: 1
                }
            },
            { $sort: { totalPoints: -1, reportsFixed: -1 } },
            { $limit: pageSize }
        ]);

        // Calculate additional stats (total submitted, acceptance rate)
        const leaderboardWithStats = await Promise.all(
            leaderboard.map(async (entry, index) => {
                const stats = await BugReport.aggregate([
                    { $match: { userId: entry.userId } },
                    {
                        $group: {
                            _id: null,
                            totalSubmitted: { $sum: 1 },
                            accepted: {
                                $sum: {
                                    $cond: [
                                        { $in: ['$status', ['accepted', 'fixed']] },
                                        1,
                                        0
                                    ]
                                }
                            }
                        }
                    }
                ]);

                const totalSubmitted = stats[0]?.totalSubmitted || 0;
                const accepted = stats[0]?.accepted || 0;
                const acceptanceRate = totalSubmitted > 0 
                    ? Math.round((accepted / totalSubmitted) * 100) 
                    : 0;

                return {
                    rank: index + 1,
                    ...entry,
                    totalSubmitted,
                    acceptanceRate
                };
            })
        );

        return res.json({
            leaderboard: leaderboardWithStats,
            period
        });
    } catch (err) {
        console.error('getLeaderboard error:', err);
        return next(new HttpError('Gagal memuat leaderboard!', 500));
    }
};

/**
 * Get dashboard metrics (Admin only)
 * GET /api/bugReports/metrics
 */
const getMetrics = async (req, res, next) => {
    const userRole = req.userData.userRole;

    if (userRole !== 'admin') {
        return next(new HttpError('Hanya admin yang dapat melihat metrik!', 403));
    }

    try {
        const metrics = await BugReport.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
                    reviewing: { $sum: { $cond: [{ $eq: ['$status', 'reviewing'] }, 1, 0] } },
                    accepted: { $sum: { $cond: [{ $eq: ['$status', 'accepted'] }, 1, 0] } },
                    rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
                    fixed: { $sum: { $cond: [{ $eq: ['$status', 'fixed'] }, 1, 0] } },
                    totalPointsIssued: { $sum: { $cond: [{ $eq: ['$status', 'fixed'] }, '$pointsAwarded', 0] } }
                }
            }
        ]);

        const result = metrics[0] || {
            total: 0,
            pending: 0,
            reviewing: 0,
            accepted: 0,
            rejected: 0,
            fixed: 0,
            totalPointsIssued: 0
        };

        return res.json({ metrics: result });
    } catch (err) {
        console.error('getMetrics error:', err);
        return next(new HttpError('Gagal memuat metrik!', 500));
    }
};

module.exports = {
    getBugReports,
    getBugReportById,
    createBugReport,
    updateBugReportStatus,
    addBugReportUpdate,
    deleteBugReport,
    getLeaderboard,
    getMetrics
};
