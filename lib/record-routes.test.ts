import { describe, expect, it } from "vitest";

import { recordTarget } from "@/lib/record-routes";

/* Seven screens that used to be seven routes now answer to one file, and the
   only thing standing between a link and a blank page is this table. A typo in
   a path segment here does not throw — it quietly 404s a link the app has
   shipped all along. So each address the app has ever linked to is pinned to
   the screen that has to answer it, plus the shapes that must not resolve at
   all. */

describe("recordTarget", () => {
  it("maps every record address the app links to", () => {
    expect(recordTarget(["devices", "dev_1"])).toEqual({ screen: "devices", id: "dev_1" });
    expect(recordTarget(["activity-log", "log_1"])).toEqual({ screen: "activity-log", id: "log_1" });
    expect(recordTarget(["login-activity", "evt_1"])).toEqual({
      screen: "login-activity",
      id: "evt_1",
    });
    expect(recordTarget(["download-data", "exp_1"])).toEqual({
      screen: "download-data",
      id: "exp_1",
    });
    expect(recordTarget(["connected-apps", "app_1"])).toEqual({
      screen: "connected-apps",
      id: "app_1",
    });
    expect(recordTarget(["account-status", "restrictions"])).toEqual({
      screen: "status-section",
      section: "restrictions",
    });
    expect(recordTarget(["account-status", "restrictions", "res_1"])).toEqual({
      screen: "status-item",
      section: "restrictions",
      item: "res_1",
    });
  });

  it("does not claim paths that belong to a screen of their own", () => {
    /* These all exist as pages. If the table ever answered one of them, the
       catch-all would swallow it and the page would never render. */
    expect(recordTarget(["account-status", "history"])).toBeNull();
    expect(recordTarget(["help", "sessions"])).toBeNull();
    expect(recordTarget(["devices", "sign-out"])).toBeNull();
    expect(recordTarget(["security"])).toBeNull();
  });

  it("refuses shapes no screen can open", () => {
    expect(recordTarget([])).toBeNull();
    expect(recordTarget(["devices"])).toBeNull();
    expect(recordTarget(["devices", ""])).toBeNull();
    expect(recordTarget(["devices", "a", "b"])).toBeNull();
    expect(recordTarget(["account-status", "restrictions", "res_1", "extra"])).toBeNull();
    expect(recordTarget(["", "restrictions"])).toBeNull();
    /* The recently-deleted tray was seeded with six example rows, because
       nothing in Tirbeo could write a real one — there is no content model, so
       no per-item delete to undo. The screen is gone with the invention, and an
       old bookmark of one of its addresses 404s rather than opening a blank. */
    expect(recordTarget(["recently-deleted", "del_1"])).toBeNull();
  });
});