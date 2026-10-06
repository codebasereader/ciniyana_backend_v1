/**
 * Minimal structured audit trail for security-relevant and admin actions.
 * One JSON line per event on stdout (picked up by pm2/journald), so it can
 * be shipped or grepped without extra infrastructure.
 */
exports.audit = (req, action, details = {}) => {
  try {
    console.log(
      JSON.stringify({
        type: "audit",
        at: new Date().toISOString(),
        action,
        actor: req.user?.email || details.actor || null,
        ip: req.ip,
        ...details,
      })
    );
  } catch {
    // Auditing must never break the request.
  }
};

/** Express middleware: logs successful (2xx) mutating requests on a route group. */
exports.auditMutations = (entity) => (req, res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    res.on("finish", () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        exports.audit(req, `${entity}.${req.method.toLowerCase()}`, {
          path: req.originalUrl.split("?")[0],
          status: res.statusCode,
        });
      }
    });
  }
  next();
};
