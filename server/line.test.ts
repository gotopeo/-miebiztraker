import { describe, it, expect } from "vitest";
import { ENV } from "./_core/env";

describe("LINE Messaging API Configuration", () => {
  it("should have LINE_CHANNEL_SECRET configured", () => {
    expect(ENV.lineChannelSecret).toBeTruthy();
    expect(ENV.lineChannelSecret.length).toBeGreaterThan(0);
  });

  it("should have LINE_CHANNEL_ACCESS_TOKEN configured", () => {
    expect(ENV.lineChannelAccessToken).toBeTruthy();
    expect(ENV.lineChannelAccessToken.length).toBeGreaterThan(0);
  });

  it("LINE_CHANNEL_SECRET should not be the default placeholder", () => {
    expect(ENV.lineChannelSecret).not.toBe("");
    expect(ENV.lineChannelSecret).not.toBe("your_channel_secret_here");
  });

  it("LINE_CHANNEL_ACCESS_TOKEN should not be the default placeholder", () => {
    expect(ENV.lineChannelAccessToken).not.toBe("");
    expect(ENV.lineChannelAccessToken).not.toBe("your_channel_access_token_here");
  });
});
