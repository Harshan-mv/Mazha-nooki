require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Location = require('../models/Location');

async function run() {
  await connectDB();

  const filePath = path.join(__dirname, 'data', 'kannur_lsg.geojson');
  const geojson = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  console.log(`[seed] read ${geojson.features.length} LSG features`);

  await Location.deleteMany({});

  const docs = geojson.features.map((f) => {
    const p = f.properties;
    return {
      name: p.name,
      nameML: p.name_ml || undefined,
      lsgiCode: p.LSGI_Code,
      localAuthType: p.local_auth,
      blockGroup: p.block_group,
      district: p.District,
      centroid: { lat: p.centroid_lat, lng: p.centroid_lng },
      geometry: f.geometry
    };
  });

  const inserted = await Location.insertMany(docs);
  console.log(`[seed] inserted ${inserted.length} locations`);

  const blocks = [...new Set(inserted.map((d) => d.blockGroup))].sort();
  console.log(`[seed] ${blocks.length} block groups:`);
  blocks.forEach((b) => console.log('  -', b));

  await mongoose.disconnect();
  console.log('[seed] done');
}

run().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
