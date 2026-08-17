// Members in these lifecycle states cannot log in, refresh tokens, or use an
// already-issued access token — MemberAuthService checks this at login/
// refresh time and MemberJwtStrategy re-checks it on every authenticated
// request, so a token stops working the moment the status changes. Shared
// here so the two enforcement points can never drift out of sync.
export const BLOCKED_STATUSES = ["SUSPENDED", "DECEASED", "REJECTED"] as const;
