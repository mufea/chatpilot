export class BillingError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code = "invalid_request",
  ) {
    super(message);
    this.name = "BillingError";
  }
}
