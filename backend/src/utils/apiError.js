class ApiError extends Error {
  constructor(statusCode, message, data = null) {
    super(message);
    this.statusCode = statusCode;
    this.message = message;
    this.data = data;
  }
}

export { ApiError };
