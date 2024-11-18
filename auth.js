// middleware/auth.js
const jwt = require('jsonwebtoken');
require('dotenv').config();

function authenticateToken(req, res, next) {
  var token = String(req.headers['authorization']).split(' ')[1];
  // console.log(token)

  if (!token) {
    return res.status(401).json({ message: 'No token provided' });
  }
  jwt.verify(token, "ACHHE DIN AA GYE HAI", (err, decoded) => {
    if (err) {
      return res.status(403).json({ message: 'Failed to authenticate token' });
    }
    // console.log("Token verified");

    // Add the decoded user information to the request object
    req.user = decoded;
    next(); // Move to the next middleware or route handler
  });
}

module.exports = authenticateToken;
