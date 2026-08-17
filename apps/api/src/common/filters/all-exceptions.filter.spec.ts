import { z } from "zod";
import { ZodValidationException } from "nestjs-zod";
import { NotFoundException, type ArgumentsHost } from "@nestjs/common";
import { AllExceptionsFilter } from "./all-exceptions.filter";

function makeHost() {
  const send = jest.fn();
  const status = jest.fn().mockReturnValue({ send });
  const reply = { status };
  const host = {
    switchToHttp: () => ({
      getResponse: () => reply,
      getRequest: () => ({ url: "/api/v1/public/member-auth/register" }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, send };
}

describe("AllExceptionsFilter", () => {
  it("surfaces the real per-field reason for a Zod validation failure instead of the generic 'Validation failed'", () => {
    const filter = new AllExceptionsFilter();
    const schema = z.object({
      aadhaarNumber: z.string().regex(/^\d{12}$/, "Aadhaar number must be 12 digits"),
    });
    const result = schema.safeParse({ aadhaarNumber: "90149018872" }); // 11 digits
    expect(result.success).toBe(false);
    const exception = new ZodValidationException((result as { error: z.ZodError }).error);

    const { host, status, send } = makeHost();
    filter.catch(exception, host);

    expect(status).toHaveBeenCalledWith(400);
    const body = send.mock.calls[0][0];
    expect(body.message).not.toBe("Validation failed");
    expect(body.message).toContain("Aadhaar number must be 12 digits");
    expect(body.message).toContain("aadhaarNumber");
  });

  it("still uses the plain message for a normal HttpException", () => {
    const filter = new AllExceptionsFilter();
    const { host, status, send } = makeHost();
    filter.catch(new NotFoundException("Member not found"), host);

    expect(status).toHaveBeenCalledWith(404);
    expect(send.mock.calls[0][0].message).toBe("Member not found");
  });
});
