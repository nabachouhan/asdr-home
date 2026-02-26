// index.js (or mainRoutes)

import express from 'express';
const router = express.Router();

// Import route modules (make sure each is using `export default`)
import homeRoutes from './home.js';
import gisRoutes from './gis.js';
import userRoutes from './user.js';
import catalogRoutes from './catalog.js';
import adminRoutes from './admin.js';

// Mount routes
router.use('/', homeRoutes);
router.use('/gis', gisRoutes);
router.use('/user', userRoutes);
router.use('/catalog', catalogRoutes);
router.use('/admin', adminRoutes);

// ❗ This 404 should be here ONLY
router.get('*', (req, res) => {
    res.status(404).render("404");
});

// Export router
export default router;
