import express from "express";

import buysell from "./functions/index.js";
import "dotenv/config";
const app = express();

app.get('/', (req, res) => {
  res.send('Hello World');  
});
app.get('/buysell', (req, res) => {
  const newbuysell = new buysell;
  newbuysell.main();
  res.send('Hello World');  
});

const port = 3000;

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);  
});