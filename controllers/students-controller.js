const HttpError = require("../models/http-error");
const mongoose = require("mongoose");
const { generateThumbnailBase64 } = require("../utils/thumbnail-generator");

const SubBranch = require("../models/subBranch");
const Student = require("../models/student");
const User = require("../models/user");

const getStudents = async (req, res, next) => {
    const {
        role,
        branchId,
        subBranchId,
        page,
        limit,
        search,
        sortBy,
        sortDir,
        isActive,
        isProfileComplete,
        isInternal,
        group,
        branch,
    } = req.query;

    const shouldPaginate =
        page !== undefined ||
        limit !== undefined ||
        search !== undefined ||
        sortBy !== undefined ||
        sortDir !== undefined ||
        isActive !== undefined ||
        isProfileComplete !== undefined ||
        isInternal !== undefined ||
        group !== undefined ||
        branch !== undefined ||
        branchId !== undefined ||
        subBranchId !== undefined;

    if (!shouldPaginate) {
        // Legacy behaviour: return the full list (used by some existing views)
        let students;
        try {
            students = await Student.find()
                .populate({
                    path: "userId",
                    select: "subBranchId",
                    populate: {
                        path: "subBranchId",
                        select: "name",
                        populate: { path: "branchId", select: "name" },
                    },
                })
                .populate({
                    path: "classIds",
                    select: ["name", "subBranchId"],
                    populate: {
                        path: "teachingGroupId",
                        select: "branchYearId",
                        populate: {
                            path: "branchYearId",
                            select: ["name", "isActive"],
                        },
                    },
                })
                .sort({ nis: 1 });

            students = students.map((student) => {
                const isActiveComputed = student.classIds.some(
                    (classId) => classId.teachingGroupId.branchYearId.isActive
                );
                return { ...student.toObject({ getters: true }), isActive: isActiveComputed };
            });
        } catch (err) {
            console.log(err);
            return next(new HttpError("Internal server error occured!", 500));
        }
        console.log("Get all students requested (legacy)");
        return res.json({ students });
    }

    // Server-side pagination, search, filter, and sort
    const pageNumber = Math.max(parseInt(page || "1", 10), 1);
    const pageSize = Math.min(Math.max(parseInt(limit || "10", 10), 1), 200);

    const searchRegex = search ? new RegExp(search, "i") : null;

    const sortFieldMap = {
        name: "name",
        nis: "nis",
        isActive: "isActive",
        isInternal: "isInternal",
        isProfileComplete: "isProfileComplete",
        branch: "branchName",
        group: "groupName",
    };
    const resolvedSortField = sortFieldMap[sortBy] || "name";
    const resolvedSortDir = sortDir === "desc" ? -1 : 1;

    // Build the aggregation pipeline
    const pipeline = [
        {
            $lookup: {
                from: "users",
                let: { userId: "$userId" },
                pipeline: [
                    { $match: { $expr: { $eq: ["$_id", "$$userId"] } } },
                    {
                        $lookup: {
                            from: "subbranches",
                            localField: "subBranchId",
                            foreignField: "_id",
                            as: "subBranch",
                        },
                    },
                    { $unwind: { path: "$subBranch", preserveNullAndEmptyArrays: true } },
                    {
                        $lookup: {
                            from: "branches",
                            localField: "subBranch.branchId",
                            foreignField: "_id",
                            as: "branch",
                        },
                    },
                    { $unwind: { path: "$branch", preserveNullAndEmptyArrays: true } },
                ],
                as: "user",
            },
        },
        { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
        {
            $lookup: {
                from: "classes",
                localField: "classIds",
                foreignField: "_id",
                as: "classes",
                pipeline: [
                    {
                        $lookup: {
                            from: "teachinggroups",
                            localField: "teachingGroupId",
                            foreignField: "_id",
                            as: "teachingGroup",
                        },
                    },
                    { $unwind: { path: "$teachingGroup", preserveNullAndEmptyArrays: true } },
                    {
                        $lookup: {
                            from: "branchyears",
                            localField: "teachingGroup.branchYearId",
                            foreignField: "_id",
                            as: "branchYear",
                        },
                    },
                    { $unwind: { path: "$branchYear", preserveNullAndEmptyArrays: true } },
                ],
            },
        },
        {
            $addFields: {
                branchName: "$user.branch.name",
                branchIdFromUser: "$user.branch._id",
                groupName: "$user.subBranch.name",
                groupIdFromUser: "$user.subBranch._id",
                isActive: {
                    $anyElementTrue: {
                        $map: {
                            input: "$classes",
                            as: "cls",
                            in: "$$cls.branchYear.isActive",
                        },
                    },
                },
                userId: {
                    $mergeObjects: [
                        "$user",
                        {
                            subBranchId: {
                                $mergeObjects: ["$user.subBranch", { branchId: "$user.branch" }],
                            },
                        },
                    ],
                },
                classIds: "$classes",
            },
        },
    ];

    // Filters
    const filterMatch = {};

    // Role-scoped filters
    if (role === "branchAdmin") {
        if (branchId && mongoose.Types.ObjectId.isValid(branchId)) {
            filterMatch.branchIdFromUser = new mongoose.Types.ObjectId(branchId);
        }
    } else if (role && role !== "admin") {
        if (subBranchId && mongoose.Types.ObjectId.isValid(subBranchId)) {
            filterMatch.groupIdFromUser = new mongoose.Types.ObjectId(subBranchId);
        }
    }

    // Explicit filters from query
    if (branch && mongoose.Types.ObjectId.isValid(branch)) {
        filterMatch.branchIdFromUser = new mongoose.Types.ObjectId(branch);
    }
    if (group && mongoose.Types.ObjectId.isValid(group)) {
        filterMatch.groupIdFromUser = new mongoose.Types.ObjectId(group);
    }

    if (isActive !== undefined) {
        if (isActive === "true" || isActive === true) filterMatch.isActive = true;
        else if (isActive === "false" || isActive === false) filterMatch.isActive = false;
    }
    if (isProfileComplete !== undefined) {
        if (isProfileComplete === "true" || isProfileComplete === true) filterMatch.isProfileComplete = true;
        else if (isProfileComplete === "false" || isProfileComplete === false) filterMatch.isProfileComplete = false;
    }
    if (isInternal !== undefined) {
        if (isInternal === "true" || isInternal === true) filterMatch.isInternal = true;
        else if (isInternal === "false" || isInternal === false) filterMatch.isInternal = false;
    }

    if (Object.keys(filterMatch).length > 0) {
        pipeline.push({ $match: filterMatch });
    }

    if (searchRegex) {
        pipeline.push({
            $match: {
                $or: [{ name: searchRegex }, { nis: searchRegex }],
            },
        });
    }

    const pipelineForCount = [...pipeline, { $count: "total" }];

    pipeline.push({ $sort: { [resolvedSortField]: resolvedSortDir, _id: 1 } });
    pipeline.push({ $skip: (pageNumber - 1) * pageSize });
    pipeline.push({ $limit: pageSize });

    try {
        const [students, countResult] = await Promise.all([
            Student.aggregate(pipeline),
            Student.aggregate(pipelineForCount),
        ]);

        const total = countResult[0]?.total || 0;
        const totalPages = Math.max(Math.ceil(total / pageSize), 1);

        const branchesMeta = new Set();
        const groupsMeta = new Set();
        students.forEach((st) => {
            if (st.branchIdFromUser && st.branchName) {
                branchesMeta.add(JSON.stringify({ id: st.branchIdFromUser.toString(), name: st.branchName }));
            }
            if (st.groupIdFromUser && st.groupName) {
                groupsMeta.add(JSON.stringify({ id: st.groupIdFromUser.toString(), name: st.groupName }));
            }
        });

        console.log("Get students requested (paginated)");
        return res.json({
            students,
            page: pageNumber,
            limit: pageSize,
            total,
            totalPages,
            hasNext: pageNumber < totalPages,
            hasPrev: pageNumber > 1,
            filterMeta: {
                branches: Array.from(branchesMeta).map((v) => JSON.parse(v)),
                groups: Array.from(groupsMeta).map((v) => JSON.parse(v)),
            },
        });
    } catch (err) {
        console.log(err);
        return next(new HttpError("Internal server error occured!", 500));
    }
};

const getStudentById = async (req, res, next) => {
    const studentId = req.params.studentId;
    const { populate } = req.query;

    let student;

    try {
        if (populate === "attendance") {
            student = await Student.findById(studentId)
                .populate({
                    path: "userId",
                    select: "subBranchId",
                    populate: {
                        path: "subBranchId",
                        select: "name",
                        populate: { path: "branchId", select: "name" },
                    },
                })
                .populate({
                    path: "attendanceIds",
                    populate: { path: "classId", select: "name" },
                });
        } else {
            student = await Student.findById(studentId)
                .populate({
                    path: "userId",
                    select: "subBranchId",
                    populate: {
                        path: "subBranchId",
                        select: "name",
                        populate: { path: "branchId", select: "name" },
                    },
                })
                .populate({
                    path: "classIds",
                    populate: { path: "teachingGroupId" },
                });
        }
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    console.log("Get student requested");
    if (!student) {
        return next(new HttpError("Student not found!", 404));
    }

    res.json({ student: student.toObject({ getters: true }) });
};

const getStudentByNis = async (req, res, next) => {
    const nis = req.params.nis;

    let student;
    try {
        student = await Student.find({ nis: nis });
        // .populate({ path: 'userId', select: 'name', populate: { path: 'branchId', select: 'name' } });

        if (student.length === 0) {
            return next(new HttpError("Student not found!", 404));
        }

        student = {
            nis: student[0].nis,
            name: student[0].name,
            email: student[0].email,
        }; // Access the first element
    } catch (err) {
        console.log(err);
        return next(new HttpError("Internal server error occured!", 500));
    }

    console.log(`Get student with ${nis}`);
    res.json({ student });
};

const getStudentByUserId = async (req, res, next) => {
    const userId = req.params.userId;

    let student;

    try {
        student = await Student.findOne({ userId }).populate({
            path: "userId",
            select: "subBranchId",
            populate: {
                path: "subBranchId",
                select: "name",
                populate: { path: "branchId", select: "name" },
            },
        });
        // .populate({
        //     path: 'classIds',
        //     populate: [
        //         { path: 'teachingGroupYearId', populate: { path: 'academicYearId', select: ['name', 'isActive'] } },
        //         { path: 'attendances', select: 'forDate' }
        //     ]
        // });
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    console.log(`Get student by userId ${userId} requested`);
    res.json({ student: student.toObject({ getters: true }) });
};

const getStudentReportByIdAndClassId = async (req, res, next) => {
    const { studentId, classId } = req.body;

    let student;
    try {
        student = await Student.find({ _id: studentId, classIds: classId })
            .populate({
                path: "userId",
                select: "subBranchId",
                populate: {
                    path: "subBranchId",
                    select: "name",
                    populate: { path: "branchId", select: "name" },
                },
            })
            .populate({
                path: "attendanceIds",
                populate: { path: "classId", select: "name" },
            });
    } catch (err) {
        console.error(err);
        return next(new HttpError("Internal server error occurred!", 500));
    }

    console.log("Get student requested");
    res.json({ student: student.toObject({ getters: true }) });
};

const getStudentsByBranchId = async (req, res, next) => {
    const branchId = req.params.branchId;

    let students;
    try {
        // 1. Find subBranches with the given branchId
        const subBranches = await SubBranch.find({ branchId: branchId });
        const subBranchIds = subBranches.map((sb) => sb._id);

        // 2. Find users with subBranchId in subBranchIds
        const users = await User.find({ subBranchId: { $in: subBranchIds } });

        // 3. Extract user IDs
        const userIds = users.map((user) => user._id);

        // 4. Find students based on user IDs
        students = await Student.find({ userId: { $in: userIds } })
            .populate({
                path: "userId",
                select: "subBranchId",
                populate: {
                    path: "subBranchId",
                    select: "name",
                    populate: {
                        path: "branchId",
                        select: "name",
                    },
                },
            })
            .populate({
                path: "classIds",
                select: ["name", "subBranchId"],
                populate: {
                    path: "teachingGroupId",
                    select: "branchYearId",
                    populate: {
                        path: "branchYearId",
                        select: ["name", "isActive"],
                    },
                },
            })
            .sort({ nis: 1 });

        students = students.map((student) => {
            const isActive = student.classIds.some(
                (classId) => classId.teachingGroupId.branchYearId.isActive
            );
            return { ...student.toObject({ getters: true }), isActive };
        });
    } catch (err) {
        console.log(err);
        return next(new HttpError("Internal server error occured!", 500));
    }
    console.log("Get students by branch ID requested");
    res.json({ students });
};

const getStudentsBySubBranchId = async (req, res, next) => {
    const subBranchId = req.params.subBranchId;

    let students;
    try {
        // 1. Find matching users
        const users = await User.find({ subBranchId: subBranchId });

        // 2. Extract user IDs
        const userIds = users.map((user) => user._id);

        // 3. Find students based on user IDs
        students = await Student.find({ userId: { $in: userIds } })
            .populate({
                path: "userId",
                select: "subBranchId",
                populate: {
                    path: "subBranchId",
                    select: "name",
                    populate: {
                        path: "branchId",
                        select: "name",
                    },
                },
            })
            .populate({
                path: "classIds",
                select: ["name", "subBranchId"],
                populate: {
                    path: "teachingGroupId",
                    select: "branchYearId",
                    populate: {
                        path: "branchYearId",
                        select: ["name", "isActive"],
                    },
                },
            })
            .sort({ nis: 1 });

        students = students.map((student) => {
            const isActive = student.classIds.some(
                (classId) => classId.teachingGroupId.branchYearId.isActive
            );
            return { ...student.toObject({ getters: true }), isActive };
        });
    } catch (err) {
        console.log(err);
        return next(new HttpError("Internal server error occured!", 500));
    }
    console.log("Get users requested");
    res.json({ students });
};

const createStudent = async (req, res, next) => {
    const { name, email, nis } = req.body;

    let identifiedUser;
    try {
        identifiedUser = await User.findOne({ email });
    } catch (err) {
        console.log(err);
        console.log(identifiedUser);
        return next(new HttpError("Internal server error!", 500));
    }

    if (!identifiedUser) {
        return next(new HttpError("User tidak ditemukan!", 500));
    }

    const createdStudent = new Student({
        userId: identifiedUser.id,
        name,
        nis,
        dateOfBirth: "",
        gender: "",
        parentName: "",
        parentPhone: "",
        address: "",
        image: "",
        thumbnail: "",
        attendanceIds: [],
        classIds: [],
    });

    try {
        await createdStudent.save();
    } catch (err) {
        console.log(err);
        const error = new HttpError("Gagal menambahkan peserta didik!", 500);
        return next(error);
    }

    res.status(202).json({
        message: `Berhasil mendaftarkan peserta didik! ${name}!`,
        student: createdStudent,
    });
};

const updateStudent = async (req, res, next) => {
    const { nis, name, dateOfBirth, gender, parentName, parentPhone, address } =
        req.body;
    const studentId = req.params.studentId;

    let student;
    try {
        const updateData = {
            ...(nis && { nis }),
            name,
            dateOfBirth,
            gender,
            address,
            parentName,
            parentPhone,
            isProfileComplete: true,
        };

        let thumbnail = null;
        if (req.file) {
            updateData.image = req.file.path.replace(/\\/g, "/");
            updateData.originalImagePath = req.file.path;

            // Generate thumbnail in the backend
            try {
                thumbnail = await generateThumbnailBase64(req.file.path);
                updateData.thumbnail = thumbnail;
            } catch (thumbnailError) {
                console.error("Failed to generate thumbnail:", thumbnailError);
                // Continue without thumbnail if generation fails
            }
        }

        student = await Student.findByIdAndUpdate(studentId, updateData, {
            new: true,
            runValidators: true,
        });

        if (student) {
            const userUpdate = { name: student.name };
            if (req?.file?.path) userUpdate.image = req.file.path;
            if (thumbnail) userUpdate.thumbnail = thumbnail;
            await User.findByIdAndUpdate(student.userId, userUpdate, {
                new: true,
                runValidators: true,
            });
        }
    } catch (err) {
        console.error(err);
        const error = new HttpError(
            "Something went wrong while updating the student.",
            500
        );
        return next(error);
    }

    if (!student) {
        return next(
            new HttpError(
                `Could not find a student with ID '${studentId}'`,
                404
            )
        );
    }

    console.log(`Student with nis '${student.nis}' updated!`);
    res.status(200).json({
        message: "Berhasil melengkapi profile siswa!",
        student: student.toObject({ getters: true }),
    });
};

exports.getStudentById = getStudentById;
exports.getStudentByNis = getStudentByNis;
exports.getStudentByUserId = getStudentByUserId;
exports.getStudentReportByIdAndClassId = getStudentReportByIdAndClassId;
exports.getStudents = getStudents;
exports.getStudentsByBranchId = getStudentsByBranchId;
exports.getStudentsBySubBranchId = getStudentsBySubBranchId;
exports.createStudent = createStudent;
exports.updateStudent = updateStudent;
