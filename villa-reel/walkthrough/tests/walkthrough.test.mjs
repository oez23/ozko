// Run with: npm test   (Node 22.18+ runs the TypeScript sources directly)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { buildTimeline, orderRooms } from "../../src/walkthrough/scenes.ts";
import { validateWalkthrough } from "../../src/walkthrough/validate.ts";
import { kling } from "../../src/walkthrough/providers/kling.ts";
import { higgsfield } from "../../src/walkthrough/providers/higgsfield.ts";
import { aiClipToRoom, submitJob } from "../../src/walkthrough/providers/types.ts";
import { guessProjection, importVideo } from "../../src/walkthrough/providers/video-import.ts";
import { validateTourUrl } from "../../src/walkthrough/tour/tourUrl.ts";

const example = () => ({
  orientation: "horizontal",
  ...JSON.parse(readFileSync(new URL("../props.example.json", import.meta.url), "utf8")),
});
const errors = (props) =>
  validateWalkthrough(props).filter((i) => i.level === "error").map((i) => i.path);
const released = () => {
  const props = example();
  props.mode = "final";
  props.rights = { ownerApproval: true, imageRightsCleared: true, privacyChecked: true };
  props.rooms.forEach((r) => (r.verification = "verified"));
  return props;
};
const job = {
  id: "wohnzimmer-zu-kueche",
  fromRoom: "Wohnbereich",
  toRoom: "Küche",
  startFrame: "photos/04-wohnzimmer.webp",
  endFrame: "photos/05-kueche.webp",
  durationSec: 5,
  aspectRatio: "16:9",
};

test("example props are a valid draft", () => {
  assert.deepEqual(errors(example()), []);
});

test("timeline length = intro + clips + end card − overlapping transitions", () => {
  // 60 + (120+120+90+120+105+135) + 90 = 840; transitions 18+18+18+0+15+18+18 = 105
  assert.equal(buildTimeline(example()).totalFrames, 735);
});

test("final mode blocks unverified clips and missing rights", () => {
  const props = example();
  props.mode = "final";
  const e = errors(props);
  assert.ok(e.includes("rooms[0].verification"));
  assert.ok(e.includes("rights.ownerApproval"));
  assert.ok(e.includes("rights.privacyChecked"));
  assert.deepEqual(errors(released()), []);
});

test("rejected clips never reach the timeline", () => {
  const props = example();
  props.rooms[1].verification = "rejected";
  const ids = buildTimeline(props).segments.map((s) => s.room?.id);
  assert.ok(!ids.includes("kueche"));
});

test("media paths: no URLs, no traversal, no tours as video", () => {
  for (const src of [
    "https://example.com/a.mp4",
    "walkthrough/../../secret.mp4",
    "/etc/passwd.mp4",
    "photos/04-wohnzimmer.webp",
    "https://my.matterport.com/show/?m=abc",
  ]) {
    const props = example();
    props.rooms[0].source.src = src;
    assert.ok(errors(props).includes("rooms[0].source.src"), src);
  }
});

test("equirectangular sources must be reprojected first", () => {
  const props = example();
  props.rooms[0].source.projection = "equirectangular";
  assert.ok(errors(props).includes("rooms[0].source.projection"));
  assert.equal(guessProjection({ width: 3840, height: 1920, durationSec: 5, sphericalTag: false }), "equirectangular");
  assert.equal(guessProjection({ width: 1920, height: 1080, durationSec: 5, sphericalTag: false }), "flat");
});

test("3D exports need a source reference", () => {
  const props = example();
  props.rooms[0].method = "matterport-export";
  assert.ok(errors(props).includes("rooms[0].sourceReference"));
  props.rooms[0].sourceReference = "Matterport-Tour abc123, Export 2026-11-10";
  assert.deepEqual(errors(props), []);
});

test("AI clips: need provenance, and human review before release", () => {
  const room = aiClipToRoom(kling, job, "walkthrough/ai/wohnzimmer-zu-kueche.mp4");
  assert.equal(room.verification, "pending");
  assert.equal(room.ai.connectionConfirmed, false);

  const draft = example();
  draft.rooms.splice(1, 0, room);
  assert.deepEqual(errors(draft), []);

  const final = released();
  final.rooms.splice(1, 0, { ...room, verification: "verified" });
  const e = errors(final);
  assert.ok(e.includes("rooms[1].ai.geometryReviewed"));
  assert.ok(e.includes("rooms[1].ai.connectionConfirmed"));

  const bare = example();
  bare.rooms[0].method = "ai-transition";
  assert.ok(errors(bare).includes("rooms[0].ai"));
});

test("transition longer than a clip is rejected", () => {
  const props = example();
  props.rooms[0].transitionToNext = { type: "fade", durationSec: 5 };
  assert.equal(errors(props).length, 1);
});

test("room order is configurable and invents nothing", () => {
  const rooms = example().rooms;
  const ordered = orderRooms(rooms, ["terrasse", "eingang", "kueche"]).map((r) => r.id);
  assert.deepEqual(ordered.slice(0, 2), ["terrasse", "kueche"]);
  assert.equal(ordered.length, rooms.length);
});

test("providers never send without approval, credentials and transport", async () => {
  let sent = 0;
  const transport = async () => ({ jobId: `job-${++sent}` });
  const env = { KLING_ACCESS_KEY: "a", KLING_SECRET_KEY: "b" };
  await assert.rejects(submitJob(kling, job, { approvedPaidCall: false, env, transport }), /nicht freigegeben/);
  await assert.rejects(submitJob(kling, job, { approvedPaidCall: true, env: {}, transport }), /Zugangsdaten/);
  await assert.rejects(submitJob(kling, job, { approvedPaidCall: true, env }), /kein Transport/);
  await assert.rejects(submitJob(higgsfield, job, { approvedPaidCall: true, env, transport }), /Zugangsdaten/);
  assert.equal(sent, 0);
  const ok = await submitJob(kling, job, { approvedPaidCall: true, env, transport });
  assert.equal(ok.jobId, "job-1");
  assert.match(ok.request.prompt, /Do not add rooms/);
});

test("imported videos start unreviewed", () => {
  const room = importVideo({ id: "flur", name: "Flur", src: "walkthrough/flur.mp4", method: "gimbal", durationSec: 4 });
  assert.equal(room.verification, "pending");
});

test("tour URLs: https and exact allowlisted host only", () => {
  assert.equal(validateTourUrl("https://my.matterport.com/show/?m=abc").ok, true);
  for (const url of [
    "http://my.matterport.com/show/?m=abc",
    "https://my.matterport.com.evil.example/show",
    "https://evil.example/?u=my.matterport.com",
    "https://user:pw@my.matterport.com/show",
    "javascript:alert(1)",
    "not a url",
  ]) {
    assert.equal(validateTourUrl(url).ok, false, url);
  }
  assert.equal(validateTourUrl("https://tour.kunde.example/x", ["tour.kunde.example"]).ok, true);
});
