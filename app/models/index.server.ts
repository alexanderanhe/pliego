import mongoose, { Schema } from "mongoose";
const userSchema = new Schema(
  {
    projectRevision: { type: Number, default: 0 },
    email: { type: String, required: true },
    normalizedEmail: { type: String, required: true, unique: true },
    emailVerifiedAt: Date,
    name: String,
    role: { type: String, enum: ["user", "admin"], default: "user" },
    plan: { type: String, enum: ["free", "premium"], default: "free" },
    planStatus: {
      type: String,
      enum: ["active", "trialing", "past_due", "canceled"],
      default: "active",
    },
    planExpiresAt: Date,
    entitlements: { type: [String], default: [] },
    calibration: { factor: Number, width: Number, height: Number },
  },
  { timestamps: true },
);
const codeSchema = new Schema(
  {
    normalizedEmail: { type: String, required: true, index: true },
    codeHash: { type: String, required: true },
    purpose: {
      type: String,
      enum: ["sign_in", "verify_email"],
      required: true,
    },
    expiresAt: { type: Date, required: true },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    consumedAt: Date,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
codeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const sessionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    lastUsedAt: Date,
    userAgent: String,
    ipHash: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const projectSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true, maxlength: 100 },
    sourceImageMetadata: { type: Schema.Types.Mixed, required: true },
    config: { type: Schema.Types.Mixed, required: true },
    paper: Schema.Types.Mixed,
    orientation: String,
    units: String,
    posterDimensions: Schema.Types.Mixed,
    pageGrid: Schema.Types.Mixed,
    margins: Number,
    overlap: Number,
    fitMode: String,
    crop: Schema.Types.Mixed,
    background: String,
    guides: Schema.Types.Mixed,
    qualityEstimate: Number,
    schemaVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);
projectSchema.index({ userId: 1, updatedAt: -1 });
const rateSchema = new Schema({ _id: String, count: Number, expiresAt: Date });
rateSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const User = mongoose.models.User || mongoose.model("User", userSchema);
export const VerificationCode =
  mongoose.models.VerificationCode ||
  mongoose.model("VerificationCode", codeSchema);
export const Session =
  mongoose.models.Session || mongoose.model("Session", sessionSchema);
export const PosterProject =
  mongoose.models.PosterProject ||
  mongoose.model("PosterProject", projectSchema);
export const RateLimit =
  mongoose.models.RateLimit || mongoose.model("RateLimit", rateSchema);
