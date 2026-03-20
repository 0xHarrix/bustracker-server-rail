/* eslint-disable no-console */
require("dotenv").config();
const mongoose = require("mongoose");
const User = require("../src/modules/users/user.model");

const run = async () => {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGODB_URI (or MONGO_URI) is required.");
  }

  const dryRun = process.argv.includes("--dry-run");
  await mongoose.connect(mongoUri);

  const parents = await User.find({ role: "parent", isActive: true })
    .select("_id schoolId name")
    .lean();

  let mapped = 0;
  for (const parent of parents) {
    const legacyStudent = await User.findOne({
      schoolId: parent.schoolId,
      role: "student",
      parentId: parent._id,
      isActive: true,
    })
      .select("_id")
      .lean();
    if (legacyStudent) continue;

    if (!dryRun) {
      await User.create({
        name: `${parent.name} - Student`,
        role: "student",
        schoolId: parent.schoolId,
        parentId: parent._id,
        isActive: true,
      });
    }
    mapped += 1;
  }

  console.log(
    `[migrate-parent-student] ${dryRun ? "Dry run" : "Completed"}: ${mapped} parent records mapped.`
  );
  await mongoose.disconnect();
};

run().catch(async (err) => {
  console.error(err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
