import express from 'express';
const router = express.Router();

router.get('/', (req, res) => {
    // Your OpenLayers logic here
    // res.sendFile(path.join(__dirname, 'public', 'openlayers', 'gis.html'));
    res.send('404')

});

router.get('*', (req, res) => {
    // Your OpenLayers logic here
    // res.render("adminQueries");
    res.render('404')

});
export default router;