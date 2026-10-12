const express = require("express");
const cord = require("cors");
const helmet = require("helmet");
const ratelimit = require('express-rate-limit');

const authRouter = require("./routes/auth.routes");
const churchrouter = require("./routes/church.routes");
const members