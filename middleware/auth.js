const jwt = require("jsonwebtoken");

exports.authenticate = (req, res, next) => {
  try {
    const header = req.headers.authorization;
    const bearerToken = header && header.startsWith("Bearer ") ? header.slice(7) : null;
    // Cookie is the normal (browser) path; the Authorization header is kept
    // as a fallback for non-browser API clients.
    const token = req.cookies?.accessToken || bearerToken;

    if (!token) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== "access") {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
};
