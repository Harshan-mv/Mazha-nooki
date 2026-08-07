const express = require('express');
const Location = require('../models/Location');

const router = express.Router();

// GET /api/locations -> list all locations (lightweight, no geometry) grouped by block
router.get('/', async (req, res) => {
  try {
    const locations = await Location.find({}, '-geometry').sort({ blockGroup: 1, name: 1 });
    res.json(locations);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch locations', details: err.message });
  }
});

// GET /api/locations/geojson -> full GeoJSON FeatureCollection for the map (all panchayats/municipalities)
router.get('/geojson', async (req, res) => {
  try {
    const locations = await Location.find({});
    const featureCollection = {
      type: 'FeatureCollection',
      features: locations.map((loc) => ({
        type: 'Feature',
        properties: {
          id: loc._id,
          name: loc.name,
          nameML: loc.nameML,
          localAuthType: loc.localAuthType,
          blockGroup: loc.blockGroup,
          district: loc.district
        },
        geometry: loc.geometry
      }))
    };
    res.json(featureCollection);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch geojson', details: err.message });
  }
});

// GET /api/locations/blocks -> distinct block groups (for the "choose block" dropdown/list)
router.get('/blocks', async (req, res) => {
  try {
    const blocks = await Location.distinct('blockGroup');
    res.json(blocks.sort());
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch blocks', details: err.message });
  }
});

module.exports = router;
