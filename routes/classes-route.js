const express = require("express");

const classController = require("../controllers/classes-controller");

const router = express.Router();

router.get("/", classController.getClasses);
router.get("/sub-branch/:subBranchId", classController.getClassesBySubBranchId);
router.get(
    "/sub-branch/:subBranchId/academic-year/:academicYearId",
    classController.getClassesBySubBranchIdAndAcademicYearId
);
router.get("/:classId", classController.getClassById);

router.get(
    "/teaching-group/:teachingGroupId",
    classController.getClassesByTeachingGroupId
);
router.get(
    "/teachingGroupYear/:teachingGroupYearId",
    classController.getClassesByTeachingGroupYearId
);
router.get(
    "/:classId/student/:studentId",
    classController.getClassAttendanceByIdAndStudentId
);

router.post("/get-by-ids", classController.getClassesByIds);

router.post("/", classController.createClass);
router.post("/register-student", classController.registerStudentToClass);
router.post("/register-teacher", classController.registerTeacherToClass);

router.delete("/", classController.deleteClass);
router.delete("/remove-student", classController.removeStudentFromClass);
router.delete("/remove-teacher", classController.removeTeacherFromClass);

router.patch("/lock", classController.lockClassById);
router.patch("/unlock", classController.unlockClassById);
router.patch("/:classId", classController.updateClassById);

module.exports = router;
