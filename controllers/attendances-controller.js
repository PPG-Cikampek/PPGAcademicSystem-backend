const HttpError = require("../models/http-error");
const mongoose = require("mongoose");

const User = require("../models/user");
const Branch = require("../models/branch");
const BranchYear = require("../models/branchYear");
const TeachingGroup = require("../models/teachingGroup");
const AcademicYear = require("../models/academicYear");
const Class = require("../models/class");
const Student = require("../models/student");
const Teacher = require("../models/teacher");
const Attendance = require("../models/attendance");
const teacher = require("../models/teacher");

const getAttendanceById = async (req, res, next) => {
    const attendanceId = req.params.attendanceId;

    let identifiedAttendance;
    try {
        identifiedAttendance = await Attendance.findById(attendanceId).populate(
            { path: "studentId", select: "name" }
        );

        if (!identifiedAttendance) {
            return next(
                new HttpError(
                    `Attendance with ID ${attendanceId} not found!`,
                    404
                )
            );
        }
    } catch (error) {
        console.error(error);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    console.log("getAttendanceById requested");
    res.status(200).json({
        attendance: identifiedAttendance.toObject({ getters: true }),
    });
};

const getAttendancesByAcademicYearId = async (req, res, next) => {
    const academicYearId = req.params.academicYearId;

    let identifiedAcademicYear;
    try {
        identifiedAcademicYear = await AcademicYear.findById(
            academicYearId
        ).populate({
            path: "teachingGroupYears",
            populate: {
                path: "classes",
                populate: {
                    path: "attendances",
                    populate: {
                        path: "studentId",
                        select: "name",
                    },
                },
            },
        });

        if (!identifiedAcademicYear) {
            return next(
                new HttpError(
                    `Attendance with ID ${attendanceId} not found!`,
                    404
                )
            );
        }
    } catch (error) {
        console.error(error);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    console.log("getAttendanceById requested");
    res.status(200).json({
        academicYears: identifiedAcademicYear.toObject({ getters: true }),
    });
};

const createNewAttendanceForClass = async (req, res, next) => {
    console.log("createNewAttendanceForClass requested");
    const { classId, branchId, branchYearId, subBranchId } = req.body;

    let identifiedClass;
    try {
        identifiedClass = await Class.findById(classId);
    } catch (err) {
        console.log(err);
        return next(new HttpError("Internal server error!", 500));
    }

    if (!identifiedClass) {
        return next(new HttpError("Class not found!", 500));
    }

    const session = await mongoose.startSession();
    session.startTransaction(); // Start the transaction

    try {
        const students = identifiedClass.students;
        const timestamp = new Date().toISOString();
        const forDate = new Date().toLocaleDateString("en-CA");

        const attendances = [];

        // Step 1: Create attendance documents
        for (const studentId of students) {
            // Check if attendance already exists
            const existingAttendance = await Attendance.findOne(
                { forDate, studentId },
                null,
                { session }
            );
            if (existingAttendance) {
                console.log(
                    `Attendance for student ${studentId} on ${forDate} already exists, skipping.`
                );
                continue;
            }

            const attendance = new Attendance({
                forDate,
                timestamp,
                status: "Tanpa Keterangan",
                violations: {
                    attribute: false,
                    attitude: false,
                    tidiness: false,
                },
                teachersNotes: "",
                studentId,
                branchId,
                branchYearId,
                subBranchId,
                teachingGroupId: identifiedClass.teachingGroupId,
                classId,
            });

            const createdAttendance = await attendance.save({ session });
            attendances.push(createdAttendance);
        }

        // Commit the transaction
        await session.commitTransaction();
        session.endSession();

        console.log("Attendances created and references updated successfully.");
        res.status(202).json({ message: "New Attendances Created!" });
    } catch (error) {
        // Rollback the transaction in case of an error
        await session.abortTransaction();
        session.endSession();
        console.log(error);
        return next(new HttpError("Internal server error occurred!", 500));
    }
};

const getAttendancesByClass = async (req, res, next) => {
    const classId = req.params.classId;

    // Validate input
    if (!classId) {
        return next(new HttpError("ClassId required!", 400));
    }

    try {
        // Query MongoDB for documents matching the provided date and classId
        const attendances = await Attendance.find({ classId })
            .populate({ path: "studentId", select: "name" })
            .sort({ forDate: 1 });

        if (attendances.length === 0) {
            return res.status(200).json({});
        }

        console.log(`Retrieved attendances for classId ${classId}`);

        // Group attendances by date
        const groupedAttendances = {};
        attendances.forEach(attendance => {
            const date = new Date(attendance.forDate);
            const formattedDate = new Intl.DateTimeFormat('id-ID', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric'
            }).format(date);
            if (!groupedAttendances[formattedDate]) {
                groupedAttendances[formattedDate] = [];
            }
            groupedAttendances[formattedDate].push(attendance);
        });

        res.status(200).json(groupedAttendances);
    } catch (error) {
        console.error("Error retrieving attendances:", error);
        return next(new HttpError("Internal server error occured!", 500));
    }
};

const getAttendancesByDateAndClass = async (req, res, next) => {
    const classId = req.params.classId;
    const { date } = req.body;

    // console.log(classId)
    console.log(date);

    // Validate input
    if (!date || !classId) {
        return next(new HttpError("Date and ClassId required!", 400));
    }

    try {
        // Parse the date to ensure it's in a valid Date format
        const formattedDate = new Date(date);

        if (isNaN(formattedDate.getTime())) {
            return next(new HttpError("Invalid date format!", 400));
        }

        console.log(formattedDate);

        // Query MongoDB for documents matching the provided date and classId
        const attendances = await Attendance.find({
            forDate: formattedDate,
            classId,
        }).populate({
            path: "studentId",
            select: ["name", "nis", "image", "thumbnail"],
        });
        if (!attendances) {
            return res.status(404).json({
                message:
                    "No attendance records found for the given date and classId",
            });
        }

        console.log(`Retrieved attendances by classId and Date ${classId}`);
        res.status(200).json(attendances);
    } catch (error) {
        console.error("Error retrieving attendances:", error);
        res.status(500).json({
            error: "An error occurred while retrieving attendances",
        });
    }
};

const deleteAttendanceById = async (req, res, next) => {
    const { studentName } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const attendanceId = req.params.attendanceId;

        // Step 1: Find the Attendance document
        const attendance = await Attendance.findById(attendanceId).session(
            session
        );
        if (!attendance) {
            return next(new HttpError("Attendance ID not found!", 404));
        }

        const { studentId, classId } = attendance;

        // Step 2: Delete the Attendance document
        await Attendance.findByIdAndDelete(attendanceId, { session });

        // Step 3: Remove the reference from the Class schema
        await Class.findByIdAndUpdate(
            classId,
            { $pull: { attendances: attendanceId } },
            { session }
        );

        // Step 4: Remove the reference from the Student schema
        await Student.findByIdAndUpdate(
            studentId,
            { $pull: { attendanceIds: attendanceId } },
            { session }
        );

        // Step 5: Commit the transaction
        await session.commitTransaction();
        session.endSession();
    } catch (error) {
        await session.abortTransaction();
        console.error("Error during transaction, rolled back:", error);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    res.status(200).json({
        message: `Berhasil menghapus absen siswa: ${studentName}`,
    });
};

const updateAttendancesByIds = async (req, res, next) => {
    const { updates } = req.body;

    if (!Array.isArray(updates)) {
        return next(
            new HttpError(
                'Invalid input format. "updates" must be an array.',
                400
            )
        );
    }

    try {
        const updatePromises = updates.map(
            ({
                attendanceId,
                status,
                attributes,
                violations,
                timestamp,
                updateReason,
                teachersNotes,
            }) =>
                Attendance.findByIdAndUpdate(
                    attendanceId,
                    {
                        status,
                        attributes,
                        violations,
                        timestamp,
                        updateReason,
                        teachersNotes,
                    },
                    { new: true, runValidators: true }
                )
        );

        const results = await Promise.all(updatePromises);

        // Check for missing attendances
        const notFoundIds = updates
            .filter((_, index) => !results[index])
            .map((update) => update.attendanceId);

        if (notFoundIds.length > 0) {
            return next(
                new HttpError(
                    `Attendance IDs not found: ${notFoundIds.join(", ")}`,
                    404
                )
            );
        }
        console.log("Updated attendances");
        res.status(200).json({
            message: "Berhasil memperbarui data kehadiran!",
            results,
        });
    } catch (error) {
        console.error(error);
        return next(new HttpError("Internal server error occurred!", 500));
    }
};

/**
 * Retrieves an overview of attendance data based on various filters.
 * This endpoint aggregates attendance records, calculates statistics, and provides student-wise and class-wise summaries.
 * Supports filtering by academic year, branch, sub-branch, teaching group, class, teacher classes, and date range.
 * Returns overall stats, violation stats, student data with attendance percentages, and optionally class-grouped data for sub-branch admins.
 */
const getAttendanceOverview = async (req, res, next) => {
    // Extract filter parameters from request body
    const {
        academicYearId,
        branchYearId,
        branchId,
        subBranchId,
        teachingGroupId,
        classId,
        teacherClassIds,
        startDate,
        endDate,
    } = req.body;

    console.log(teacherClassIds);

    if (req.userData.userRole === "teacher" && !classId) {
        if (
            req.userData.userRole === "teacher" &&
            (teacherClassIds === undefined || !teacherClassIds.length > 0)
        ) {
            return next(
                new HttpError(
                    "Unauthorized access: No teaching classes found.",
                    403
                )
            );
        }
    }

    // Define empty response structure for cases with no data
    const emptyResponse = {
        studentsData: [],
        overallStats: [],
        violationStats: [],
    };
    console.log("[getAttendanceOverview] Request body:", req.body);

    try {
        // Helper function to normalize IDs to strings
        const toId = (obj) => obj?._id?.toString() || obj?.toString() || obj;

        // Normalize teacher class IDs and single class ID
        const teacherClassIdsArr =
            teacherClassIds &&
            Array.isArray(teacherClassIds) &&
            teacherClassIds.length > 0
                ? teacherClassIds.map((id) => toId(id))
                : null;
        const classIdStr = classId ? toId(classId) : null;
        // console.log(
        //     "[getAttendanceOverview] teacherClassIdsArr:",
        //     teacherClassIdsArr,
        //     "classIdStr:",
        //     classIdStr
        // );

        // Build base attendance filter from provided parameters
        const attendanceFilter = {};
        if (branchId) attendanceFilter.branchId = branchId;
        if (branchYearId) attendanceFilter.branchYearId = branchYearId; // new: allow filtering by branchYear
        // if (subBranchId) attendanceFilter.subBranchId = subBranchId;
        if (teachingGroupId) attendanceFilter.teachingGroupId = teachingGroupId;

        if (teacherClassIdsArr)
            attendanceFilter.classId = { $in: teacherClassIdsArr };
        else if (classIdStr) attendanceFilter.classId = classIdStr;
        // console.log(
        //     "[getAttendanceOverview] Initial attendanceFilter:",
        //     attendanceFilter
        // );

        // Apply date range filter if startDate and endDate are provided
        if (startDate && endDate) {
            const s = new Date(startDate);
            const e = new Date(endDate);
            if (isNaN(s.getTime()) || isNaN(e.getTime())) {
                // console.log(
                //     "[getAttendanceOverview] Invalid date format:",
                //     startDate,
                //     endDate
                // );
                return next(
                    new HttpError(
                        "Invalid date format for startDate or endDate!",
                        400
                    )
                );
            }
            attendanceFilter.forDate = { $gte: s, $lte: e };
            // console.log(
            //     "[getAttendanceOverview] Date range filter applied:",
            //     attendanceFilter.forDate
            // );
        }

        // Simplified academic year / branch-year validation: derive class IDs from
        // branchYearId (preferred) or academicYearId (fallback) and restrict/filter classId accordingly.
        let classIds = null;

        if (branchYearId) {
            // If branchYearId is provided, it takes precedence over academicYearId.
            const branchYear = await BranchYear.findById(branchYearId)
                .populate({
                    path: "teachingGroups",
                    select: "classes",
                    populate: { path: "classes", select: "name" },
                })
                .lean();

            if (!branchYear) {
                console.log(
                    "[getAttendanceOverview] No branchYear found for:",
                    branchYearId
                );
                return res.status(200).json(emptyResponse);
            }

            classIds = [];
            for (const teachingGroup of branchYear.teachingGroups || []) {
                for (const cls of teachingGroup.classes || []) {
                    classIds.push(toId(cls));
                }
            }

            if (classIds.length === 0) {
                console.log(
                    "[getAttendanceOverview] No classIds found in branchYear"
                );
                return res.status(200).json(emptyResponse);
            }

            // Enforce requested classId(s) to be within the branchYear classes
            if (attendanceFilter.classId) {
                const requestedIds = attendanceFilter.classId.$in
                    ? attendanceFilter.classId.$in.map(toId)
                    : [toId(attendanceFilter.classId)];

                if (!requestedIds.every((id) => classIds.includes(id))) {
                    console.log(
                        "[getAttendanceOverview] Requested classIds not in branchYear classIds"
                    );
                    return res.status(200).json(emptyResponse);
                }
            } else {
                attendanceFilter.classId = { $in: classIds };
                console.log(
                    "[getAttendanceOverview] attendanceFilter.classId set to branchYear classIds"
                );
            }
        } else if (academicYearId) {
            const academicYear = await AcademicYear.findById(academicYearId)
                .populate({
                    path: "branchYears",
                    populate: {
                        path: "teachingGroups",
                        select: "classes",
                        populate: { path: "classes", select: "name" },
                    },
                })
                .lean();

            if (!academicYear) {
                return res.status(200).json(emptyResponse);
            }

            // Flatten class IDs from the academic year's structure
            classIds = [];
            for (const branchYear of academicYear.branchYears || []) {
                for (const teachingGroup of branchYear.teachingGroups || []) {
                    for (const cls of teachingGroup.classes || []) {
                        classIds.push(toId(cls));
                    }
                }
            }

            if (classIds.length === 0) {
                console.log(
                    "[getAttendanceOverview] No classIds found in academicYear"
                );
                return res.status(200).json(emptyResponse);
            }

            // Validate requested class IDs against academic year
            if (attendanceFilter.classId) {
                const requestedIds = attendanceFilter.classId.$in
                    ? attendanceFilter.classId.$in.map(toId)
                    : [toId(attendanceFilter.classId)];

                if (!requestedIds.every((id) => classIds.includes(id))) {
                    console.log(
                        "[getAttendanceOverview] Requested classIds not in academicYear classIds"
                    );
                    return res.status(200).json(emptyResponse);
                }
            } else {
                attendanceFilter.classId = { $in: classIds };
                console.log(
                    "[getAttendanceOverview] attendanceFilter.classId set to academicYear classIds"
                );
            }
        }

        // Determine final class IDs for roster collection based on inputs
        const rosterClassIds =
            teacherClassIdsArr || (classIdStr ? [classIdStr] : classIds);
        // console.log("[getAttendanceOverview] rosterClassIds:", rosterClassIds);

        // Pre-collect student IDs from classes and apply subBranch filtering if specified
        let finalStudentIds = [];
        if (rosterClassIds && rosterClassIds.length > 0) {
            const classes = await Class.find({ _id: { $in: rosterClassIds } })
                .select("students")
                .lean();
            // console.log(
            //     "[getAttendanceOverview] Loaded classes for rosterClassIds:",
            //     classes
            // );
            const rosterStudentIds = [
                ...new Set(
                    classes.flatMap((c) => (c.students || []).map(toId))
                ),
            ];
            // console.log(
            //     "[getAttendanceOverview] rosterStudentIds:",
            //     rosterStudentIds
            // );

            if (subBranchId) {
                const usersInSub = await User.find({ subBranchId })
                    .select("_id")
                    .lean();
                const userIds = usersInSub.map((u) => toId(u));
                // console.log(
                //     "[getAttendanceOverview] userIds in subBranch:",
                //     userIds
                // );

                if (userIds.length === 0) {
                    // console.log(
                    //     "[getAttendanceOverview] No users found in subBranch:",
                    //     subBranchId
                    // );
                    return res.status(200).json(emptyResponse);
                }

                const filteredStudents = await Student.find({
                    userId: { $in: userIds },
                    _id: { $in: rosterStudentIds },
                })
                    .select("_id")
                    .lean();
                // console.log(
                //     "[getAttendanceOverview] filteredStudents:",
                //     filteredStudents
                // );

                finalStudentIds = filteredStudents.map((s) => toId(s));
            } else {
                finalStudentIds = rosterStudentIds;
            }
            // console.log(
            //     "[getAttendanceOverview] finalStudentIds:",
            //     finalStudentIds
            // );

            if (finalStudentIds.length === 0) {
                console.log(
                    "[getAttendanceOverview] No finalStudentIds after filtering"
                );
                return res.status(200).json(emptyResponse);
            }
        }

        // Single attendance query with complete filter, including student IDs
        const completeFilter = { ...attendanceFilter };
        if (finalStudentIds.length > 0) {
            completeFilter.studentId = { $in: finalStudentIds };
        }
        // console.log(
        //     "[getAttendanceOverview] completeFilter for Attendance.find:",
        //     completeFilter
        // );

        const attendances = await Attendance.find(completeFilter)
            .populate({
                path: "studentId",
                select: ["name", "nis", "image", "thumbnail"],
            })
            .populate({
                path: "classId",
                select: "name teachers",
                populate: { path: "teachers", select: ["name", "nig"] },
            })
            .populate({
                path: "teachingGroupId",
                select: "name branchYearId subBranches",
                populate: [
                    {
                        path: "branchYearId",
                        select: "branchId",
                        populate: { path: "branchId", select: "name" },
                    },
                    { path: "subBranches", select: "name" },
                ],
            })
            .populate({ path: "branchId", select: "name" })
            .populate({ path: "subBranchId", select: "name" })
            .sort({ forDate: 1, "studentId.name": 1 })
            .lean();
        console.log(
            "[getAttendanceOverview] attendances found:",
            attendances.length
        );

        // Helper functions for statistics
        // Calculate overall attendance statistics with percentages summing to 100
        const getOverallStats = (atts) => {
            const statusCounts = atts.reduce((acc, a) => {
                const s = a.status || "Tanpa Keterangan";
                acc[s] = (acc[s] || 0) + 1;
                return acc;
            }, {});
            const total = atts.length;
            if (total === 0) return [];

            // Compute exact fractional percentages, then distribute remainder to ensure whole numbers sum to 100
            const items = Object.keys(statusCounts).map((status) => {
                const count = statusCounts[status];
                const rawPct = (count / total) * 100;
                return {
                    status,
                    count,
                    rawPct,
                    floorPct: Math.floor(rawPct),
                    frac: rawPct - Math.floor(rawPct),
                };
            });

            let sumFloor = items.reduce((s, it) => s + it.floorPct, 0);
            let remainder = 100 - sumFloor;

            // Sort by fractional part descending to distribute remaining 1% chunks fairly
            items.sort(
                (a, b) =>
                    b.frac - a.frac ||
                    b.count - a.count ||
                    a.status.localeCompare(b.status)
            );
            for (let i = 0; i < items.length && remainder > 0; i++) {
                items[i].floorPct += 1;
                remainder -= 1;
            }

            // If for any reason remainder is negative or still positive, adjust the largest count
            if (remainder !== 0) {
                // Find max by count
                const maxIdx = items.reduce(
                    (maxI, it, idx) =>
                        it.count > items[maxI].count ? idx : maxI,
                    0
                );
                items[maxIdx].floorPct += remainder;
            }

            const statsArr = items
                .map((it) => ({
                    status: it.status,
                    count: it.count,
                    percentage: it.floorPct,
                }))
                .sort((a, b) => a.status.localeCompare(b.status));

            console.log("[getAttendanceOverview] getOverallStats:", statsArr);
            return statsArr;
        };

        // Calculate violation statistics from attendance records
        const getViolationStats = (atts) => {
            const violationCounts = {};
            atts.forEach((a) => {
                if (!a.violations || typeof a.violations !== "object") return;
                Object.entries(a.violations).forEach(
                    ([violation, occurred]) => {
                        if (occurred)
                            violationCounts[violation] =
                                (violationCounts[violation] || 0) + 1;
                    }
                );
            });
            const statsArr = Object.entries(violationCounts).map(
                ([violation, count]) => ({ violation, count })
            );
            // console.log("[getAttendanceOverview] getViolationStats:", statsArr);
            return statsArr;
        };

        // Consolidate 'Hadir' and 'Terlambat' into 'Hadir'
        const consolidateStats = (statsArr) => {
            let hadirCount = 0;
            let terlambatCount = 0;
            const otherStats = [];
            statsArr.forEach((stat) => {
                if (stat.status === "Hadir") hadirCount += stat.count;
                else if (stat.status === "Terlambat")
                    terlambatCount += stat.count;
                else otherStats.push(stat);
            });
            const totalCount =
                hadirCount +
                terlambatCount +
                otherStats.reduce((sum, s) => sum + s.count, 0);
            if (totalCount === 0) return [];
            const newHadir = {
                status: "Hadir",
                count: hadirCount + terlambatCount,
            };
            const allStats = [newHadir, ...otherStats];
            // Recalculate percentages
            allStats.forEach((stat) => {
                stat.percentage = Math.round((stat.count / totalCount) * 100);
            });
            // Adjust to sum to 100
            let sum = allStats.reduce((s, stat) => s + stat.percentage, 0);
            if (sum !== 100) {
                const maxStat = allStats.reduce(
                    (max, stat) => (stat.count > max.count ? stat : max),
                    allStats[0]
                );
                maxStat.percentage += 100 - sum;
            }
            return allStats.sort((a, b) => a.status.localeCompare(b.status));
        };

        // Fetch student data for aggregation
        const students =
            finalStudentIds.length > 0
                ? await Student.find({ _id: { $in: finalStudentIds } })
                      .select("name nis thumbnail")
                      .lean()
                : [];
        console.log(
            "[getAttendanceOverview] students loaded for aggregation:",
            students.length
        );
        const studentMap = {};
        students.forEach((s) => {
            studentMap[toId(s)] = s;
        });

        // Status normalization maps for consistent status handling
        const statusMap = {
            present: "Hadir",
            hadir: "Hadir",
            late: "Terlambat",
            terlambat: "Terlambat",
            permission: "Izin",
            izin: "Izin",
            sick: "Sakit",
            sakit: "Sakit",
            "tanpa keterangan": "Tanpa Keterangan",
            "": "Tanpa Keterangan",
        };
        const commonStatuses = [
            "Hadir",
            "Terlambat",
            "Izin",
            "Sakit",
            "Tanpa Keterangan",
        ];

        // Initialize student aggregation structure
        const studentAgg = {};
        finalStudentIds.forEach((id) => {
            const sd = studentMap[id] || {};
            studentAgg[id] = {
                id,
                name: sd.name || "",
                nis: sd.nis || "",
                thumbnail: sd.thumbnail || "",
                attendances: commonStatuses.reduce((o, s) => {
                    o[s] = 0;
                    return o;
                }, {}),
                violationData: {
                    "Perlengkapan Belajar": 0,
                    Sikap: 0,
                    Kerapihan: 0,
                },
            };
        });
        // console.log(
        //     "[getAttendanceOverview] Initialized studentAgg:",
        //     studentAgg
        // );

        // Aggregate attendance data into studentAgg
        attendances.forEach((att) => {
            if (!att.studentId) return;
            const sid = toId(att.studentId);

            if (!studentAgg[sid]) {
                const sd = studentMap[sid] || {};
                studentAgg[sid] = {
                    id: sid,
                    name: sd.name || "",
                    nis: sd.nis || "",
                    image: sd.image || null,
                    thumbnail: sd.thumbnail || "",
                    attendances: commonStatuses.reduce((o, s) => {
                        o[s] = 0;
                        return o;
                    }, {}),
                    violationData: {
                        "Perlengkapan Belajar": 0,
                        Sikap: 0,
                        Kerapihan: 0,
                    },
                };
            }

            const rawStatus = (att.status || "Tanpa Keterangan")
                .toString()
                .trim();
            const mapped =
                statusMap[rawStatus.toLowerCase()] ||
                rawStatus.charAt(0).toUpperCase() + rawStatus.slice(1);
            if (!studentAgg[sid].attendances.hasOwnProperty(mapped))
                studentAgg[sid].attendances[mapped] = 0;
            studentAgg[sid].attendances[mapped]++;

            // Track violations
            if (att.violations && typeof att.violations === "object") {
                if (att.violations.attribute)
                    studentAgg[sid].violationData["Perlengkapan Belajar"]++;
                if (att.violations.attitude)
                    studentAgg[sid].violationData["Sikap"]++;
                if (att.violations.tidiness)
                    studentAgg[sid].violationData["Kerapihan"]++;
            }
        });
        // console.log(
        //     "[getAttendanceOverview] Aggregated studentAgg:",
        //     studentAgg
        // );

        // Consolidate Hadir and Terlambat for non-admin users
        if (req.userData.userRole !== "admin") {
            Object.values(studentAgg).forEach((student) => {
                const hadirCount = student.attendances["Hadir"] || 0;
                const terlambatCount = student.attendances["Terlambat"] || 0;
                student.attendances["Hadir"] = hadirCount + terlambatCount;
                delete student.attendances["Terlambat"];
            });
        }

        // Calculate percentages for each student's attendance statuses
        Object.values(studentAgg).forEach((student) => {
            const counts = student.attendances;
            const keys = Object.keys(counts);
            const totalCount = keys.reduce((s, k) => s + counts[k], 0);

            if (totalCount === 0) {
                keys.forEach((k) => {
                    counts[k] = 0;
                });
                return;
            }

            const percentages = keys.map((k) =>
                Math.round((counts[k] / totalCount) * 100)
            );
            const sum = percentages.reduce((a, b) => a + b, 0);

            // Adjust largest percentage to ensure sum = 100
            if (sum !== 100) {
                const maxIndex = percentages.indexOf(Math.max(...percentages));
                percentages[maxIndex] += 100 - sum;
            }

            keys.forEach((k, i) => {
                counts[k] = percentages[i];
            });
        });
        // console.log(
        //     "[getAttendanceOverview] studentAgg after percentage calculation:",
        //     studentAgg
        // );

        // Sort studentsData alphabetically by name
        const studentsData = Object.values(studentAgg).sort((a, b) =>
            (a.name || "").localeCompare(b.name || "")
        );
        // console.log("[getAttendanceOverview] studentsData:", studentsData);

        // Build studentsDataByClass for subBranchAdmin ND branchAdmin role only
        let studentsDataByClass = [];

        const classIdsToGroup =
            rosterClassIds?.length > 0
                ? rosterClassIds
                : [
                      ...new Set(
                          attendances
                              .map((a) => toId(a.classId))
                              .filter(Boolean)
                      ),
                  ];
        // console.log(
        //     "[getAttendanceOverview] classIdsToGroup for subBranchAdmin:",
        //     classIdsToGroup
        // );

        if (classIdsToGroup.length > 0) {
            const classesForGroup = await Class.find({
                _id: { $in: classIdsToGroup },
            })
                .select("_id name students")
                .lean();
            const classStudentMap = {};
            classesForGroup.forEach((c) => {
                classStudentMap[toId(c)] = new Set(
                    (c.students || []).map(toId)
                );
            });
            // console.log(
            //     "[getAttendanceOverview] classesForGroup:",
            //     classesForGroup
            // );

            studentsDataByClass = classesForGroup
                .map((c) => {
                    const cId = toId(c);
                    const studentsInClass = studentsData.filter((sd) =>
                        classStudentMap[cId]?.has(sd.id)
                    );
                    const attendancesForClass = attendances.filter(
                        (a) => toId(a.classId) === cId
                    );

                    const overallArr = getOverallStats(attendancesForClass);
                    const consolidatedArr =
                        req.userData.userRole !== "admin"
                            ? consolidateStats(overallArr)
                            : overallArr;
                    const attendancesObj = consolidatedArr.reduce((o, it) => {
                        o[it.status] = it.percentage;
                        return o;
                    }, {});

                    // Calculate unique attendance dates for the class
                    const uniqueDates = new Set(
                        attendancesForClass.map(
                            (a) =>
                                a.forDate &&
                                new Date(a.forDate).toISOString().slice(0, 10)
                        )
                    );

                    return {
                        classId: cId,
                        clsName: c.name || "",
                        subBranchId:
                            attendancesForClass[0]?.subBranchId._id || "",
                        subBranchName:
                            attendancesForClass[0]?.subBranchId?.name || "",
                        studentsCount: studentsInClass.length,
                        attendances: attendancesObj,
                        violationStats: getViolationStats(attendancesForClass),
                        attendancesCount: uniqueDates.size,
                    };
                })
                .filter((g) => g.studentsCount > 0);
            // console.log(
            //     "[getAttendanceOverview] studentsDataByClass:",
            //     studentsDataByClass
            // );
        }

        // Build additional grouped data for branchAdmin: by teaching group and by sub-branch
        let studentsDataByTeachingGroup = [];
        let studentsDataBySubBranch = [];
        let studentsDataByBranch = [];
        if (req.userData.userRole === "branchAdmin" || req.userData.userRole === "admin") {
            // Teaching group grouping: derive teachingGroupIds from attendances
            const teachingGroupIds = [
                ...new Set(
                    attendances
                        .map((a) => toId(a.teachingGroupId))
                        .filter(Boolean)
                ),
            ];

            if (teachingGroupIds.length > 0) {
                // For each teaching group, collect classes belonging to it and union their students
                const tgPromises = teachingGroupIds.map(async (tgId) => {
                    // Find classes that belong to this teaching group
                    const classesForTg = await Class.find({
                        teachingGroupId: tgId,
                    })
                        .select("_id name students")
                        .lean();

                    const classStudentSet = new Set(
                        classesForTg.flatMap((c) =>
                            (c.students || []).map(toId)
                        )
                    );

                    const studentsInGroup = studentsData.filter((sd) =>
                        classStudentSet.has(sd.id)
                    );

                    const attendancesForGroup = attendances.filter(
                        (a) => toId(a.teachingGroupId) === tgId
                    );

                    const overallArr = getOverallStats(attendancesForGroup);
                    const consolidatedArr =
                        req.userData.userRole !== "admin"
                            ? consolidateStats(overallArr)
                            : overallArr;
                    const attendancesObj = consolidatedArr.reduce((o, it) => {
                        o[it.status] = it.percentage;
                        return o;
                    }, {});

                    const uniqueDates = new Set(
                        attendancesForGroup.map(
                            (a) =>
                                a.forDate &&
                                new Date(a.forDate).toISOString().slice(0, 10)
                        )
                    );

                    // Try to get teaching group name from populated attendances
                    const tgName =
                        attendances.find(
                            (a) => toId(a.teachingGroupId) === tgId
                        )?.teachingGroupId?.name || "";

                    return {
                        teachingGroupId: tgId,
                        teachingGroupName: tgName,
                        studentsCount: studentsInGroup.length,
                        attendances: attendancesObj,
                        violationStats: getViolationStats(attendancesForGroup),
                        attendancesCount: uniqueDates.size,
                    };
                });

                studentsDataByTeachingGroup = (
                    await Promise.all(tgPromises)
                ).filter((g) => g.studentsCount > 0);
            }

            // Sub-branch grouping: derive subBranchIds from attendances (populated)
            const subBranchIds = [
                ...new Set(
                    attendances.map((a) => toId(a.subBranchId)).filter(Boolean)
                ),
            ];

            if (subBranchIds.length > 0) {
                studentsDataBySubBranch = subBranchIds
                    .map((sbId) => {
                        const attendancesForSub = attendances.filter(
                            (a) => toId(a.subBranchId) === sbId
                        );

                        const uniqueStudentIds = new Set(
                            attendancesForSub
                                .map((a) => toId(a.studentId))
                                .filter(Boolean)
                        );

                        const studentsInSub = studentsData.filter((sd) =>
                            uniqueStudentIds.has(sd.id)
                        );

                        const overallArr = getOverallStats(attendancesForSub);
                        const consolidatedArr =
                            req.userData.userRole !== "admin"
                                ? consolidateStats(overallArr)
                                : overallArr;
                        const attendancesObj = consolidatedArr.reduce(
                            (o, it) => {
                                o[it.status] = it.percentage;
                                return o;
                            },
                            {}
                        );

                        const uniqueDates = new Set(
                            attendancesForSub.map(
                                (a) =>
                                    a.forDate &&
                                    new Date(a.forDate)
                                        .toISOString()
                                        .slice(0, 10)
                            )
                        );

                        const sbName =
                            attendancesForSub[0]?.subBranchId?.name || "";

                        return {
                            subBranchId: sbId,
                            subBranchName: sbName,
                            teachingGroupId:
                                attendancesForSub[0]?.teachingGroupId._id || "",
                            teachingGroupName:
                                attendancesForSub[0]?.teachingGroupId?.name ||
                                "",
                            studentsCount: studentsInSub.length,
                            attendances: attendancesObj,
                            violationStats:
                                getViolationStats(attendancesForSub),
                            attendancesCount: uniqueDates.size,
                        };
                    })
                    .filter((g) => g.studentsCount > 0);
            }
        }

        if (req.userData.userRole === "admin") {
            const branchIds = [
                ...new Set(
                    attendances.map((a) => toId(a.branchId)).filter(Boolean)
                ),
            ];

            if (branchIds.length > 0) {
                studentsDataByBranch = branchIds
                    .map((branchIdVal) => {
                        const attendancesForBranch = attendances.filter(
                            (a) => toId(a.branchId) === branchIdVal
                        );

                        if (attendancesForBranch.length === 0) {
                            return null;
                        }

                        const uniqueStudentIds = new Set(
                            attendancesForBranch
                                .map((a) => toId(a.studentId))
                                .filter(Boolean)
                        );

                        const studentsInBranch = studentsData.filter((sd) =>
                            uniqueStudentIds.has(sd.id)
                        );

                        const overallArr = getOverallStats(
                            attendancesForBranch
                        );
                        const attendancesObj = overallArr.reduce((o, it) => {
                            o[it.status] = it.percentage;
                            return o;
                        }, {});

                        const uniqueDates = new Set(
                            attendancesForBranch.map(
                                (a) =>
                                    a.forDate &&
                                    new Date(a.forDate)
                                        .toISOString()
                                        .slice(0, 10)
                            )
                        );

                        return {
                            branchId: branchIdVal,
                            branchName:
                                attendancesForBranch[0]?.branchId?.name || "",
                            studentsCount: studentsInBranch.length,
                            attendances: attendancesObj,
                            violationStats:
                                getViolationStats(attendancesForBranch),
                            attendancesCount: uniqueDates.size,
                        };
                    })
                    .filter(Boolean);
            }
        }

        console.log(
            `[getAttendanceOverview] Retrieved ${attendances.length} attendance records`
        );

        const overallStats = getOverallStats(attendances);
        const consolidatedOverallStats =
            req.userData.userRole !== "admin"
                ? consolidateStats(overallStats)
                : overallStats;

        // Return the aggregated data
        return res.status(200).json({
            studentsData,
            studentsDataByClass,
            studentsDataByTeachingGroup,
            studentsDataBySubBranch,
            studentsDataByBranch,
            overallStats: consolidatedOverallStats,
            violationStats: getViolationStats(attendances),
        });
    } catch (error) {
        console.error(
            "[getAttendanceOverview] Error retrieving attendance reports:",
            error
        );
        return next(new HttpError("Internal server error occurred!", 500));
    }
};

const getAttendanceReports = async (req, res, next) => {
    const { academicYearId, studentId, startDate, endDate } = req.body;

    // Validate required filters
    if (!academicYearId || !studentId || !startDate || !endDate) {
        return next(
            new HttpError(
                "academicYearId, studentId, startDate and endDate are required!",
                400
            )
        );
    }

    // Parse dates and normalize to include full end day
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return next(
            new HttpError("Invalid date format for startDate or endDate!", 400)
        );
    }
    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    try {
        // Load academic year and its classes (with teachers) to find student's class
        const academicYear = await AcademicYear.findById(academicYearId)
            .populate({
                path: "branchYears",
                populate: {
                    path: "teachingGroups",
                    populate: {
                        path: "classes",
                        select: "_id name students teachers",
                        populate: { path: "teachers", select: "_id name nig" },
                    },
                },
            })
            .select("name branchYears");

        if (!academicYear) {
            return next(new HttpError("AcademicYear not found!", 404));
        }

        // Find the class in this academic year that contains the student
        let foundClass = null;
        for (const branchYear of academicYear.branchYears || []) {
            if (!branchYear.teachingGroups) continue;
            for (const tg of branchYear.teachingGroups) {
                if (!tg.classes) continue;
                for (const cls of tg.classes) {
                    if (
                        cls.students &&
                        cls.students
                            .map((s) => s.toString())
                            .includes(studentId.toString())
                    ) {
                        foundClass = cls;
                        break;
                    }
                }
                if (foundClass) break;
            }
            if (foundClass) break;
        }

        if (!foundClass) {
            return next(
                new HttpError(
                    "Student not found in the provided academic year!",
                    404
                )
            );
        }

        // Build attendance query for the student in that class and date range
        const attendanceFilter = {
            studentId,
            classId: foundClass._id,
            forDate: { $gte: start, $lte: end },
        };

        const attendances = await Attendance.find(attendanceFilter)
            .populate({ path: "studentId", select: ["name", "nis"] })
            .populate({
                path: "classId",
                select: "name teachers",
                populate: { path: "teachers", select: ["_id", "name", "nig"] },
            })
            .populate({
                path: "teachingGroupId",
                select: "name branchYearId subBranches",
                populate: [
                    {
                        path: "branchYearId",
                        select: "branchId",
                        populate: { path: "branchId", select: "name" },
                    },
                    { path: "subBranches", select: "name" },
                ],
            })
            .populate({ path: "branchId", select: "name" })
            .populate({ path: "subBranchId", select: "name" })
            .sort({ forDate: 1 });

        // Compute aggregates
        const total = attendances.length;

        const attendanceCounts = {};
        const violationCounts = { attribute: 0, attitude: 0, tidiness: 0 };
        const teachersNotes = [];

        attendances.forEach((att) => {
            // status counts
            const s = att.status || "Tanpa Keterangan";
            attendanceCounts[s] = (attendanceCounts[s] || 0) + 1;

            // violation counts
            if (att.violations) {
                if (att.violations.attribute) violationCounts.attribute++;
                if (att.violations.attitude) violationCounts.attitude++;
                if (att.violations.tidiness) violationCounts.tidiness++;
            }

            // teachers notes (non-empty)
            if (
                att.teachersNotes &&
                String(att.teachersNotes).trim().length > 0
            ) {
                const noteDate = att.forDate
                    ? new Date(att.forDate)
                    : att.timestamp
                    ? new Date(att.timestamp)
                    : null;
                const formattedDate = noteDate
                    ? new Intl.DateTimeFormat("id-ID", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                      }).format(noteDate)
                    : "";
                teachersNotes.push({
                    noteContent: att.teachersNotes,
                    noteDate: formattedDate,
                });
            }
        });

        // attendanceData array
        const attendanceData = [];
        if (total > 0) {
            // Convert counts to fractional percentages and distribute to whole integers summing to 100
            const items = Object.keys(attendanceCounts).map((status) => {
                const count = attendanceCounts[status];
                const rawPct = (count / total) * 100;
                return {
                    status,
                    count,
                    rawPct,
                    floorPct: Math.floor(rawPct),
                    frac: rawPct - Math.floor(rawPct),
                };
            });

            let sumFloor = items.reduce((s, it) => s + it.floorPct, 0);
            let remainder = 100 - sumFloor;

            items.sort(
                (a, b) =>
                    b.frac - a.frac ||
                    b.count - a.count ||
                    a.status.localeCompare(b.status)
            );
            for (let i = 0; i < items.length && remainder > 0; i++) {
                items[i].floorPct += 1;
                remainder -= 1;
            }

            if (remainder !== 0) {
                const maxIdx = items.reduce(
                    (maxI, it, idx) =>
                        it.count > items[maxI].count ? idx : maxI,
                    0
                );
                items[maxIdx].floorPct += remainder;
            }

            items.forEach((it) =>
                attendanceData.push({
                    status: it.status,
                    count: it.count,
                    percentage: String(it.floorPct),
                })
            );
        }

        // violationData array
        const violationData = Object.keys(violationCounts).map((key) => ({
            violation: key,
            count: violationCounts[key],
        }));

        // teachersNotes already oldest-first because attendances sorted ascending

        // studentData - use populated student info (if any attendance exists). If no attendance, fetch student doc
        let studentDoc = null;
        if (attendances[0] && attendances[0].studentId) {
            studentDoc = attendances[0].studentId;
        } else {
            studentDoc = await Student.findById(studentId).select("name nis");
        }

        // Determine branchName and subBranchName: prefer first attendance values, else attempt to read from class's teachingGroup
        let branchName = "";
        let subBranchName = "";
        if (attendances[0]) {
            branchName = attendances[0].branchId
                ? attendances[0].branchId.name || ""
                : "";
            subBranchName = attendances[0].subBranchId
                ? attendances[0].subBranchId.name || ""
                : "";
        }

        if (!branchName || !subBranchName) {
            // try to populate class's teaching group -> branch
            const classFull = await Class.findById(foundClass._id)
                .populate({
                    path: "teachingGroupId",
                    populate: [
                        {
                            path: "branchYearId",
                            populate: { path: "branchId", select: "name" },
                        },
                        { path: "subBranches", select: "name" },
                    ],
                })
                .populate({ path: "teachers", select: ["_id", "name", "nig"] });
            if (
                !branchName &&
                classFull &&
                classFull.teachingGroupId &&
                classFull.teachingGroupId.branchYearId &&
                classFull.teachingGroupId.branchYearId.branchId
            ) {
                branchName =
                    classFull.teachingGroupId.branchYearId.branchId.name || "";
            }
            if (
                !subBranchName &&
                classFull &&
                classFull.teachingGroupId &&
                Array.isArray(classFull.teachingGroupId.subBranches) &&
                classFull.teachingGroupId.subBranches.length > 0
            ) {
                subBranchName =
                    classFull.teachingGroupId.subBranches[0].name || "";
            }
            // ensure foundClass teachers are available
            if (!foundClass.teachers && classFull && classFull.teachers) {
                foundClass.teachers = classFull.teachers;
            }
        }

        const studentData = {
            nis: studentDoc ? studentDoc.nis || "" : "",
            name: studentDoc ? studentDoc.name || "" : "",
            branchName,
            subBranchName,
            period: `${new Intl.DateTimeFormat("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
            }).format(start)} - ${new Intl.DateTimeFormat("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
            }).format(end)}`,
        };

        const classData = {
            name: foundClass.name || "",
            academicYearName: academicYear.name || "",
            teachers: (foundClass.teachers || []).map((t) => ({
                _id: t._id,
                name: t.name,
                nig: t.nig,
            })),
        };

        console.log(
            `Retrieved student attendance report based on filters (${studentId})`
        );
        return res.status(200).json({
            attendanceData,
            violationData,
            teachersNotes,
            studentData,
            classData,
        });
    } catch (error) {
        console.error("Error retrieving student attendance report:", error);
        return next(new HttpError("Internal server error occurred!", 500));
    }
};

exports.getAttendanceOverview = getAttendanceOverview;
exports.getAttendanceReports = getAttendanceReports;

exports.getAttendanceById = getAttendanceById;
exports.getAttendancesByClass = getAttendancesByClass;
exports.getAttendancesByDateAndClass = getAttendancesByDateAndClass;
exports.getAttendancesByAcademicYearId = getAttendancesByAcademicYearId;

exports.createNewAttendanceForClass = createNewAttendanceForClass;

exports.deleteAttendanceById = deleteAttendanceById;

exports.updateAttendancesByIds = updateAttendancesByIds;
