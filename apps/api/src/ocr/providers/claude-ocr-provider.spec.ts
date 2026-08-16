import { ClaudeOcrProvider } from "./claude-ocr-provider";

const parseMock = jest.fn();

jest.mock("@anthropic-ai/sdk", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: { parse: parseMock },
    })),
  };
});

function makeProvider() {
  const config = { getOrThrow: jest.fn().mockReturnValue("test-api-key") };
  return new ClaudeOcrProvider(config as never);
}

describe("ClaudeOcrProvider.extract", () => {
  beforeEach(() => {
    parseMock.mockReset();
  });

  it("skips extraction for an unsupported (non-image) mime type without calling the API", async () => {
    const provider = makeProvider();
    const result = await provider.extract(Buffer.from("x"), "application/pdf", "AADHAAR");
    expect(result).toEqual({});
    expect(parseMock).not.toHaveBeenCalled();
  });

  it("sends an image content block and the structured-output config, and maps a successful parse", async () => {
    const provider = makeProvider();
    parseMock.mockResolvedValue({
      parsed_output: {
        fullName: "Ramesh Kumar",
        dob: "1990-05-14",
        gender: "MALE",
        aadhaarNumber: "123456789012",
        pan: null,
        voterId: null,
        passportNumber: null,
        drivingLicenceNumber: null,
      },
    });

    const result = await provider.extract(Buffer.from("fake-image-bytes"), "image/jpeg", "AADHAAR");

    expect(parseMock).toHaveBeenCalledTimes(1);
    const request = parseMock.mock.calls[0][0];
    expect(request.model).toBe("claude-opus-5");
    expect(request.messages[0].content[0]).toMatchObject({
      type: "image",
      source: expect.objectContaining({ type: "base64", media_type: "image/jpeg" }),
    });
    expect(request.output_config).toBeDefined();

    expect(result).toEqual({
      fullName: "Ramesh Kumar",
      dob: new Date("1990-05-14"),
      gender: "MALE",
      aadhaarNumber: "123456789012",
      pan: null,
      voterId: null,
      passportNumber: null,
      drivingLicenceNumber: null,
    });
  });

  it("returns an empty result when parsed_output is null", async () => {
    const provider = makeProvider();
    parseMock.mockResolvedValue({ parsed_output: null });

    const result = await provider.extract(Buffer.from("x"), "image/png", "PAN");
    expect(result).toEqual({});
  });

  it("catches an API error and returns an empty result instead of throwing", async () => {
    const provider = makeProvider();
    parseMock.mockRejectedValue(new Error("rate limited"));

    const result = await provider.extract(Buffer.from("x"), "image/png", "PAN");
    expect(result).toEqual({});
  });
});
