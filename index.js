const express = require('express');
const cors = require('cors');
require('dotenv').config();
const port = process.env.PORT || 5000;
const app = express();

app.use(cors());
app.use(express.json());

app.get('/', async (req, res) => {
    res.send("Recycle Zone API is running");
})

app.listen(port, () => {
    console.log(`Recycle Zone API is running on PORT: ${port}`);
})