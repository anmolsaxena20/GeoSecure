export const notFound = async (req, res, next) => {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  next(error);
};

export const errorHandler = async (error, _req, res, _next) => {
  console.log(error);
  const status = error.status || error.statusCode || 500;
  const message = error.message || "Internal Server Error";

  return res.status(status).json({ message });
};
