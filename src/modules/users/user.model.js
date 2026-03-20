const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true
    },

    phone: {
      type: String,
      trim: true,
      default: null
    },

    rollNumber: {
      type: String,
      trim: true,
      default: null
    },

    password: {
      type: String,
      default: null // nullable for OTP-only users
    },

    role: {
      type: String,
      enum: {
        values: ["admin", "driver", "parent", "student"],
        message: "Role must be admin, driver, parent, or student"
      },
      required: [true, "Role is required"]
    },
    // For student profiles, links the student to a parent account.
    parentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null
    },

    schoolId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "School",
      required: [true, "School is required"]
    },

    // Permanent route assignment (Model A). Never cleared on trip end.
    busId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      default: null
    },

    // Currently boarded on a trip (Model A). Set when trip starts or admin assigns to bus with active trip; cleared on trip end or unassign.
    currentBusId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bus",
      default: null
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

// ── Compound indexes for per-school uniqueness ──────────────────────────
// Phone must be unique within a school (sparse: ignore null values)
userSchema.index(
  { schoolId: 1, phone: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { phone: { $ne: null } }
  }
);

// Roll number must be unique within a school (sparse: ignore null values)
userSchema.index(
  { schoolId: 1, rollNumber: 1 },
  {
    unique: true,
    sparse: true,
    partialFilterExpression: { rollNumber: { $ne: null } }
  }
);

// Fast lookup for login by school + role
userSchema.index({ schoolId: 1, role: 1 });
userSchema.index(
  { parentId: 1 },
  { sparse: true, partialFilterExpression: { parentId: { $ne: null } } }
);

// Who is currently on a bus (boarded)
userSchema.index(
  { currentBusId: 1 },
  { sparse: true, partialFilterExpression: { currentBusId: { $ne: null } } }
);

// Never return password by default
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

module.exports = mongoose.model("User", userSchema);
