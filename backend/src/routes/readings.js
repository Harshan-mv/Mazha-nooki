const express = require('express');
const rateLimit = require('express-rate-limit');
const Reading = require('../models/Reading');
const Location = require('../models/Location');
const { classify } = require('../utils/rainfall');

const router = express.Router();

// Limit submissions to reduce spam/accidental double-posts (per IP)
const submitLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: 'Too many submissions from this network. Please try again later.' }
});

// POST /api/readings -> student submits a 24hr rainfall reading (no login required)
router.post('/', submitLimiter, async (req, res) => {
  try {
    const { locationId, observationDate, rainfallMm, locality, reporterName, reporterSchool, notes } = req.body;

    if (!locationId || !observationDate || rainfallMm === undefined || !reporterName || !reporterSchool) {
      return res.status(400).json({
        error: 'locationId, observationDate, rainfallMm, reporterName, and reporterSchool are required'
      });
    }

    const location = await Location.findById(locationId);
    if (!location) {
      return res.status(404).json({ error: 'Unknown location' });
    }

    const mm = Number(rainfallMm);
    if (Number.isNaN(mm) || mm < 0 || mm > 2000) {
      return res.status(400).json({ error: 'rainfallMm must be a number between 0 and 2000' });
    }

    const reading = await Reading.create({
      location: location._id,
      locationName: location.name,
      blockGroup: location.blockGroup,
      district: location.district,
      observationDate: new Date(observationDate),
      rainfallMm: mm,
      locality: locality?.slice(0, 120),
      reporterName: reporterName.slice(0, 80),
      reporterSchool: reporterSchool?.slice(0, 120),
      notes: notes?.slice(0, 300),
      status: 'pending'
    });

    res.status(201).json(reading);
  } catch (err) {
    res.status(500).json({ error: 'Failed to save reading', details: err.message });
  }
});

// GET /api/readings -> raw list, filterable by date/block/status (mainly for admin/debug use)
router.get('/', async (req, res) => {
  try {
    const { date, blockGroup, status, locationId } = req.query;
    const query = {};
    if (date) {
      const start = new Date(date);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1);
      query.observationDate = { $gte: start, $lt: end };
    }
    if (blockGroup) query.blockGroup = blockGroup;
    if (status) query.status = status;
    if (locationId) query.location = locationId;

    const readings = await Reading.find(query).sort({ createdAt: -1 }).limit(500);
    res.json(readings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch readings', details: err.message });
  }
});

// GET /api/readings/map?date=YYYY-MM-DD -> one aggregated value per location for that day,
// pre-classified into an alert level, ready for the choropleth map.
// Defaults to "today" (the most recent 8AM-8AM window) and only counts verified readings.
router.get('/map', async (req, res) => {
  try {
    const dateStr = req.query.date;
    const includeUnverified = req.query.includeUnverified === 'true';
    const target = dateStr ? new Date(dateStr) : new Date();
    const start = new Date(target);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);

    const statusFilter = includeUnverified ? { $in: ['pending', 'verified'] } : 'verified';

    const readings = await Reading.aggregate([
      {
        $match: {
          observationDate: { $gte: start, $lt: end },
          status: statusFilter
        }
      },
      {
        $group: {
          _id: '$location',
          avgRainfallMm: { $avg: '$rainfallMm' },
          maxRainfallMm: { $max: '$rainfallMm' },
          reportCount: { $sum: 1 },
          blockGroup: { $first: '$blockGroup' },
          locationName: { $first: '$locationName' }
        }
      }
    ]);

    const result = readings.map((r) => {
      const level = classify(r.avgRainfallMm);
      return {
        locationId: r._id,
        locationName: r.locationName,
        blockGroup: r.blockGroup,
        avgRainfallMm: Math.round(r.avgRainfallMm * 10) / 10,
        maxRainfallMm: r.maxRainfallMm,
        reportCount: r.reportCount,
        level: level?.key,
        levelLabel: level?.label,
        color: level?.color
      };
    });

    res.json({ date: start.toISOString().slice(0, 10), locations: result });
  } catch (err) {
    res.status(500).json({ error: 'Failed to build map data', details: err.message });
  }
});

module.exports = router;
