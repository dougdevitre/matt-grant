import { vi, describe, it, expect, beforeEach } from "vitest";

const { sendMock } = vi.hoisted(() => ({ sendMock: vi.fn() }));

vi.mock("@aws-sdk/client-ssm", () => ({
  SSMClient: class {
    send = sendMock;
  },
  GetParameterCommand: class {
    input: unknown;
    constructor(input: unknown) {
      this.input = input;
    }
  },
}));

import { getSecret, _clearSecretCache } from "@/lib/ssm";

beforeEach(() => {
  sendMock.mockReset();
  _clearSecretCache();
});

describe("getSecret", () => {
  it("returns the env var and never touches SSM (env-first → no-op while baked)", async () => {
    process.env.MG_TEST_ENV = "from-env";
    expect(await getSecret("MG_TEST_ENV")).toBe("from-env");
    expect(sendMock).not.toHaveBeenCalled();
    delete process.env.MG_TEST_ENV;
  });

  it("falls back to /matt-grant/<NAME> with decryption when env is unset", async () => {
    delete process.env.MG_TEST_SSM;
    sendMock.mockResolvedValue({ Parameter: { Value: "from-ssm" } });
    expect(await getSecret("MG_TEST_SSM")).toBe("from-ssm");
    const cmd = sendMock.mock.calls[0][0] as { input: { Name: string; WithDecryption: boolean } };
    expect(cmd.input.Name).toBe("/matt-grant/MG_TEST_SSM");
    expect(cmd.input.WithDecryption).toBe(true);
  });

  it("caches the SSM result for the warm container", async () => {
    sendMock.mockResolvedValue({ Parameter: { Value: "cached" } });
    expect(await getSecret("MG_TEST_CACHE")).toBe("cached");
    expect(await getSecret("MG_TEST_CACHE")).toBe("cached");
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("returns undefined (and caches) when the parameter is missing/unauthorized", async () => {
    sendMock.mockRejectedValue(new Error("AccessDenied"));
    expect(await getSecret("MG_TEST_MISSING")).toBeUndefined();
    expect(await getSecret("MG_TEST_MISSING")).toBeUndefined();
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});
