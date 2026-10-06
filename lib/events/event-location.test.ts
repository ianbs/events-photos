import { describe, expect, it } from "vitest";
import { getEventMapsUrl } from "./event-location";

describe("event map links", () => {
  it("encodes addresses and preserves custom providers", () => {
    expect(getEventMapsUrl({ location: "São Paulo & Rua #1", mapsUrl: null }))
      .toBe("https://www.google.com/maps/search/?api=1&query=S%C3%A3o%20Paulo%20%26%20Rua%20%231");
    expect(getEventMapsUrl({ location: "Local", mapsUrl: "https://waze.com/ul?ll=-23,-46" }))
      .toBe("https://waze.com/ul?ll=-23,-46");
  });

  it("never renders unsafe custom URLs", () => {
    expect(getEventMapsUrl({ location: null, mapsUrl: "javascript:alert(1)" })).toBeNull();
    expect(getEventMapsUrl({ location: " ", mapsUrl: null })).toBeNull();
  });
});
