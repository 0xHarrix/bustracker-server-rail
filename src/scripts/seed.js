const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
require("dotenv").config();

const School = require("../modules/schools/school.model");
const User = require("../modules/users/user.model");
const Bus = require("../modules/buses/bus.model");

// ── Seed data ────────────────────────────────────────────────────────────
const SCHOOLS = [
  { name: "Delhi Public School", schoolCode: "DPS01" },
  { name: "St. Mary's Convent", schoolCode: "SMC01" }
];

const BUSES = [
  { busNumber: "BUS-001", schoolCode: "DPS01", capacity: 40 },
  { busNumber: "BUS-002", schoolCode: "DPS01", capacity: 30 },
  { busNumber: "BUS-101", schoolCode: "SMC01", capacity: 35 }
];

const USERS = [
  // DPS01
  {
    name: "Super Admin",
    phone: "+919999900000",
    password: "admin123",
    role: "admin",
    schoolCode: "DPS01"
  },
  {
    name: "Bus Driver Ramesh",
    phone: "+919800000001",
    password: "driver123",
    role: "driver",
    schoolCode: "DPS01",
    assignToBus: "BUS-001" // will link driver <-> bus
  },
  {
    name: "Ravi Kumar",
    phone: "+919876543210",
    rollNumber: "2024-A-101",
    password: "parent123",
    role: "parent",
    schoolCode: "DPS01",
    assignToBus: "BUS-001" // parent rides this bus
  },
  {
    name: "Priya Sharma",
    phone: "+919876543211",
    rollNumber: "2024-A-102",
    password: "parent123",
    role: "parent",
    schoolCode: "DPS01",
    assignToBus: "BUS-001"
  },
  // SMC01
  {
    name: "SMC Admin",
    phone: "+918888800000",
    password: "admin123",
    role: "admin",
    schoolCode: "SMC01"
  },
  {
    name: "Anita Verma",
    phone: "+918876543210",
    rollNumber: "2024-A-101",
    password: "parent123",
    role: "parent",
    schoolCode: "SMC01",
    assignToBus: "BUS-101"
  }
];

// ── Seed logic ───────────────────────────────────────────────────────────
async function seed() {
  console.log("Connecting to MongoDB...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected.\n");

  // ── Schools ─────────────────────────────────────────────────────────
  const schoolMap = {};
  for (const s of SCHOOLS) {
    let school = await School.findOne({ schoolCode: s.schoolCode });
    if (!school) {
      school = await School.create(s);
      console.log(`  + School created: ${school.name} (${school.schoolCode})`);
    } else {
      console.log(`  = School exists:  ${school.name} (${school.schoolCode})`);
    }
    schoolMap[s.schoolCode] = school._id;
  }
  console.log("");

  // ── Buses ───────────────────────────────────────────────────────────
  const busMap = {}; // key: "schoolCode:busNumber" -> bus doc
  for (const b of BUSES) {
    const schoolId = schoolMap[b.schoolCode];
    const key = `${b.schoolCode}:${b.busNumber}`;

    let bus = await Bus.findOne({ schoolId, busNumber: b.busNumber });
    if (!bus) {
      bus = await Bus.create({
        busNumber: b.busNumber,
        schoolId,
        capacity: b.capacity
      });
      console.log(`  + Bus created: ${bus.busNumber} (${b.schoolCode})`);
    } else {
      console.log(`  = Bus exists:  ${bus.busNumber} (${b.schoolCode})`);
    }
    busMap[key] = bus;
  }
  console.log("");

  // ── Users ───────────────────────────────────────────────────────────
  for (const u of USERS) {
    const schoolId = schoolMap[u.schoolCode];
    if (!schoolId) {
      console.log(`  ! Skipped ${u.name} — school ${u.schoolCode} not found`);
      continue;
    }

    let user = await User.findOne({ schoolId, phone: u.phone });
    if (!user) {
      const hash = await bcrypt.hash(u.password, 10);

      const busKey = u.assignToBus ? `${u.schoolCode}:${u.assignToBus}` : null;
      const busDoc = busKey ? busMap[busKey] : null;

      user = await User.create({
        name: u.name,
        phone: u.phone,
        rollNumber: u.rollNumber || null,
        password: hash,
        role: u.role,
        schoolId,
        busId: busDoc ? busDoc._id : null
      });
      console.log(`  + User created: ${user.name} (${user.role} @ ${u.schoolCode})`);

      // If driver, also set bus.driverId
      if (u.role === "driver" && busDoc) {
        busDoc.driverId = user._id;
        await busDoc.save();
        console.log(`    → Assigned to bus ${busDoc.busNumber}`);
      }
    } else {
      // Keep existing users but fix bus assignment (so re-run seed fixes stale IDs)
      const busKey = u.assignToBus ? `${u.schoolCode}:${u.assignToBus}` : null;
      const busDoc = busKey ? busMap[busKey] : null;
      const updates = {};
      if (busDoc) {
        updates.busId = busDoc._id;
        updates.currentBusId = null; // clear boarding state
      } else if (u.assignToBus === undefined || u.assignToBus === null) {
        updates.busId = null;
        updates.currentBusId = null;
      }
      if (Object.keys(updates).length) {
        await User.updateOne({ _id: user._id }, { $set: updates });
        console.log(`  = User updated: ${user.name} (${user.role} @ ${u.schoolCode}) busId synced`);
      } else {
        console.log(`  = User exists:  ${user.name} (${user.role} @ ${u.schoolCode})`);
      }
      if (u.role === "driver" && busDoc) {
        await Bus.updateOne(
          { _id: busDoc._id },
          { $set: { driverId: user._id } }
        );
        console.log(`    → Driver assigned to bus ${busDoc.busNumber}`);
      }
    }
  }

  console.log("\n--- Seed complete ---\n");

  // ── Cheat sheet ─────────────────────────────────────────────────────
  console.log("Login cheat sheet:");
  console.log("┌──────────────────────────┬────────┬────────────────┬────────────┬──────────┐");
  console.log("│ Name                     │ School │ Identifier     │ Password   │ Bus      │");
  console.log("├──────────────────────────┼────────┼────────────────┼────────────┼──────────┤");
  console.log("│ Super Admin              │ DPS01  │ +919999900000  │ admin123   │ —        │");
  console.log("│ Bus Driver Ramesh        │ DPS01  │ +919800000001  │ driver123  │ BUS-001  │");
  console.log("│ Ravi Kumar (parent)      │ DPS01  │ 2024-A-101     │ parent123  │ BUS-001  │");
  console.log("│ Ravi Kumar (parent)      │ DPS01  │ +919876543210  │ parent123  │ BUS-001  │");
  console.log("│ Priya Sharma (parent)    │ DPS01  │ 2024-A-102     │ parent123  │ BUS-001  │");
  console.log("│ SMC Admin                │ SMC01  │ +918888800000  │ admin123   │ —        │");
  console.log("│ Anita Verma (parent)     │ SMC01  │ 2024-A-101     │ parent123  │ BUS-101  │");
  console.log("└──────────────────────────┴────────┴────────────────┴────────────┴──────────┘");

  await mongoose.disconnect();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
