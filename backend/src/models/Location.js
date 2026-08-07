const mongoose = require('mongoose');

/**
 * A Location is one Local Self-Government body (Grama Panchayat,
 * Municipality, or Corporation) — the finest level we have official
 * boundary polygons for. Several Locations belong to one Block
 * (block_group), which is the level the teacher wants readings
 * aggregated to for the map's colour-coded alerts.
 */
const LocationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, index: true },
    nameML: { type: String }, // Malayalam name, if available
    lsgiCode: { type: String, index: true },
    localAuthType: {
      type: String,
      enum: ['gram_panchayat', 'municipality', 'municipal_corporation'],
      required: true
    },
    blockGroup: { type: String, required: true, index: true }, // e.g. "Kannur Block Panchayat"
    district: { type: String, required: true, default: 'Kannur', index: true },
    centroid: {
      lat: Number,
      lng: Number
    },
    geometry: {
      // Stored as raw GeoJSON geometry for direct use with Leaflet
      type: { type: String, enum: ['Polygon', 'MultiPolygon'], required: true },
      coordinates: { type: mongoose.Schema.Types.Mixed, required: true }
    }
  },
  { timestamps: true }
);

module.exports = mongoose.model('Location', LocationSchema);
