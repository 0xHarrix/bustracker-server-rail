/* eslint-disable no-console */
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/modules/users/user.model");

const run = async () => {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) throw new Error("MONGODB_URI (or MONGO_URI) is required.");

  await mongoose.connect(mongoUri);
  const students = await User.find({ role: "student", isActive: true })
    .select("_id schoolId parentId name")
    .lean();

  let invalid = 0;
  for (const student of students) {
    if (!student.parentId) {
      invalid += 1;
      console.log(`[invalid] ${student._id} (${student.name}) has no parentId`);
      continue;
    }
    const parent = await User.findOne({
      _id: student.parentId,
      schoolId: student.schoolId,
      role: "parent",
      isActive: true,
    })
      .select("_id")
      .lean();
    if (!parent) {
      invalid += 1;
      console.log(`[invalid] ${student._id} has missing/inactive parent`);
    }
  }

  console.log(`[consistency] Checked ${students.length} student records; invalid=${invalid}`);
  await mongoose.disconnect();
  process.exit(invalid ? 2 : 0);
};

run().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
