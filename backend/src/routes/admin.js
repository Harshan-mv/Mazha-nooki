const express = require('express');
const Reading = require('../models/Reading');

const router = express.Router();

// Very lightweight protection: a shared secret header, not full user auth.
// Good enough for "the teacher moderates from a school laptop", not for
// production-grade multi-admin access control.
function requireAdminKey(req, res, next) {
  const key = req.header('x-admin-key');
  if (!key || key !== process.env.ADMIN_KEY) {
    return res.status(401).json({ error: 'Missing or invalid admin key' });
  }
  next();
}

router.use(requireAdminKey);

// GET /api/admin/readings/pending
router.get('/readings/pending', async (req, res) => {
  const readings = await Reading.find({ status: 'pending' }).sort({ createdAt: -1 });
  res.json(readings);
});

// PATCH /api/admin/readings/:id  { status: 'verified' | 'rejected' }
router.patch('/readings/:id', async (req, res) => {
  const { status } = req.body;
  if (!['verified', 'rejected', 'pending'].includes(status)) {
    return res.status(400).json({ error: 'status must be verified, rejected or pending' });
  }
  const reading = await Reading.findByIdAndUpdate(req.params.id, { status }, { new: true });
  if (!reading) return res.status(404).json({ error: 'Reading not found' });
  res.json(reading);
});

// DELETE /api/admin/readings/:id
router.delete('/readings/:id', async (req, res) => {
  const reading = await Reading.findByIdAndDelete(req.params.id);
  if (!reading) return res.status(404).json({ error: 'Reading not found' });
  res.json({ deleted: true });
});

module.exports = router;
