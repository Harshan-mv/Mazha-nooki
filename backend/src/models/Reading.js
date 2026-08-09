const mongoose = require('mongoose');

/**
 * One 24-hour rainfall observation (fixed window: 8:00 AM to 8:00 AM
 * next day, matching IMD convention) submitted by a student for a
 * specific Location (panchayat/municipality/corporation).
 */
const ReadingSchema = new mongoose.Schema(
  {
    location: { type: mongoose.Schema.Types.ObjectId, ref: 'Location', required: true, index: true },

    // Denormalized so the map/list endpoints don't need extra joins
    locationName: { type: String, required: true },
    blockGroup: { type: String, required: true, index: true },
    district: { type: String, required: true, default: 'Kannur' },

    // The date the 24-hr window ENDS at 8 AM (i.e. "reading for 2 Aug" = 8AM 1 Aug -> 8AM 2 Aug)
    observationDate: { type: Date, required: true, index: true },

    rainfallMm: { type: Number, required: true, min: 0, max: 2000 },

    // Free-text landmark within the panchayat, e.g. ward / locality name
    locality: { type: String, trim: true, maxlength: 120 },

    reporterName: { type: String, required: true, trim: true, maxlength: 80 },
    reporterSchool: { type: String, required: true, trim: true, maxlength: 120 },
    notes: { type: String, trim: true, maxlength: 300 },

    // Lightweight moderation without requiring student login
    status: {
      type: String,
      enum: ['pending', 'verified', 'rejected'],
      default: 'pending',
      index: true
    }
  },
  { timestamps: true }
);

ReadingSchema.index({ location: 1, observationDate: 1 });

module.exports = mongoose.model('Reading', ReadingSchema);
