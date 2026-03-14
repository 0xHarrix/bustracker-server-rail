/**
 * Test script for per-stop boarding flow.
 * Requires: Node 18+ (for fetch), server running, seed data loaded.
 *
 * Usage: node scripts/test-trip-boarding.js
 *        API_URL=http://localhost:4000 node scripts/test-trip-boarding.js
 */
const BASE = process.env.API_URL || "http://localhost:4000";

function log(step, msg, data = null) {
  console.log(`\n[${step}] ${msg}`);
  if (data != null) console.log(JSON.stringify(data, null, 2));
}

async function request(method, path, body = null, token = null) {
  const url = new URL(path, BASE);
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (token) opts.headers["Authorization"] = `Bearer ${token}`;
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || res.statusText || res.status);
  return data;
}

async function run() {
  console.log("Base URL:", BASE);
  console.log("--- 1. Login as admin ---");
  const adminLogin = await request("POST", "/api/auth/login", {
    schoolCode: "DPS01",
    identifier: "+919999900000",
    password: "admin123"
  });
  const adminToken = adminLogin.data.token;
  log("Admin", "Logged in");

  console.log("--- 2. Login as driver (need driver's busId first) ---");
  const driverLogin = await request("POST", "/api/auth/login", {
    schoolCode: "DPS01",
    identifier: "+919800000001",
    password: "driver123"
  });
  const driverToken = driverLogin.data.token;
  const rawDriverBusId = driverLogin.data.user?.busId;
  const driverBusId = rawDriverBusId != null
    ? String(rawDriverBusId._id || rawDriverBusId.$oid || rawDriverBusId)
    : null;
  log("Driver", "Logged in", { driverBusId });

  if (!driverBusId) {
    console.log("Driver has no bus assigned. Run seed and assign driver to a bus.");
    process.exit(1);
  }

  console.log("--- 3. Get parents on the same bus as driver ---");
  const usersRes = await request("GET", "/api/users", null, adminToken);
  const toBusIdStr = (v) => (v == null ? "" : String(v._id || v.$oid || v));
  const sameBus = (u) => u.busId != null && toBusIdStr(u.busId) === driverBusId;
  const parents = usersRes.data.filter((u) => u.role === "parent" && sameBus(u));
  const parentIds = parents.map((u) => (u._id != null ? String(u._id) : String(u.id))).filter(Boolean);
  log("Parents", `${parentIds.length} parent(s) on driver's bus`, { parentIds, driverBusId });

  if (parentIds.length === 0) {
    const anyParents = usersRes.data.filter((u) => u.role === "parent");
    console.log("No parents on driver's bus. Driver busId:", driverBusId);
    if (anyParents.length) {
      console.log("Parent busIds:", anyParents.map((u) => ({ name: u.name, busId: toBusIdStr(u.busId) })));
    } else {
      console.log("No parents in school. Create parents and assign to bus (PATCH /api/users/:id/assign-bus).");
    }
    console.log("Tip: Run 'npm run seed' to reset driver + parents on same bus.");
    process.exit(1);
  }

  console.log("--- 4. Start trip (driver) ---");
  const startRes = await request("POST", "/api/trips/start", {}, driverToken);
  const trip = startRes.data;
  log("Start", "Trip started", { tripId: trip._id, students: trip.students });

  console.log("--- 5. Board first student ---");
  const board1 = await request(
    "POST",
    "/api/trips/current/board",
    { studentId: parentIds[0] },
    driverToken
  );
  log("Board 1", board1.message, { occupied: board1.data?.occupied, students: board1.data?.students?.length });

  if (parentIds.length > 1) {
    console.log("--- 6. Board second student ---");
    const board2 = await request(
      "POST",
      "/api/trips/current/board",
      { studentId: parentIds[1] },
      driverToken
    );
    log("Board 2", board2.message, { occupied: board2.data?.occupied });
  }

  console.log("--- 7. Unboard first student ---");
  const unboardRes = await request(
    "POST",
    "/api/trips/current/unboard",
    { studentId: parentIds[0] },
    driverToken
  );
  log("Unboard", unboardRes.message, { occupied: unboardRes.data?.occupied });

  console.log("--- 8. End trip ---");
  const endRes = await request("POST", "/api/trips/end", {}, driverToken);
  log("End", endRes.message, { status: endRes.data?.status, studentsOnTrip: endRes.data?.students?.length });

  console.log("\n✅ All steps passed. Per-stop boarding flow works.\n");
}

run().catch((err) => {
  console.error("\n❌ Error:", err.message);
  process.exit(1);
});
