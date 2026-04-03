const express = require('express');
const router = express.Router();

// Define routes
router.get('/', (req, res) => {
    res.render('home'); // Render home page
});

router.get('/about', (req, res) => {
    res.render('about'); // Render about page
});

// Hash navigation example
router.get('/page/:id', (req, res) => {
    const pageId = req.params.id;
    res.render(`page${pageId}`); // Render dynamic pages based on ID
});

module.exports = router;