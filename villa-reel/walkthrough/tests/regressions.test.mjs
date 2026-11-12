import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { labelOpacity } from "../../src/walkthrough/opacity.ts";
import { validateWalkthrough } from "../../src/walkthrough/validate.ts";
import { walkthroughMetadata } from "../../src/walkthrough/metadata.ts";

const example = () => ({ orientation: "horizontal", ...JSON.parse(readFileSync(new URL("../props.example.json", import.meta.url))) });
const errors = (p) => validateWalkthrough(p).filter((i) => i.level === "error");

test("short clips have finite, bounded labels with a readable middle and fades", () => {
  for (const length of [15, 21, 54, 60, 120]) {
    const opacity = Array.from({ length }, (_, frame) => labelOpacity(frame, length));
    assert.ok(opacity.every((n) => Number.isFinite(n) && n >= 0 && n <= 1));
    assert.equal(opacity[0], 0);
    assert.equal(opacity.at(-1), 0);
    assert.equal(Math.max(...opacity), 1);
    const middle = Math.floor(length / 2);
    assert.ok(opacity.slice(0, middle).every((n, i, a) => i === 0 || n >= a[i - 1]));
    assert.ok(opacity.slice(middle).every((n, i, a) => i === 0 || n <= a[i - 1]));
  }
});

test("invalid transition durations stop before timeline arithmetic", () => {
  for (const value of [-1, "oops", null, NaN, Infinity, 0, 0.001]) {
    const p = example();
    p.rooms[0].transitionToNext = { type: "fade", durationSec: value };
    assert.ok(errors(p).some((i) => i.path === "rooms[0].transitionToNext.durationSec"), String(value));
  }
  for (const value of [undefined, 1 / 30, 0.6]) {
    const p = example();
    p.rooms[0].transitionToNext = { type: "fade", durationSec: value };
    assert.deepEqual(errors(p), []);
  }
  const p = example();
  p.rooms[0].transitionToNext = { type: "cut", durationSec: 0 };
  assert.deepEqual(errors(p), []);
});

test("empty final exports cannot bypass rights or room validation", () => {
  const metadata = walkthroughMetadata("vertical");
  assert.throws(() => metadata({ props: { ...example(), mode: "final", rooms: [] } }), /mindestens ein Raum/);
  const draft = metadata({ props: { ...example(), rooms: [] } });
  assert.equal(draft.durationInFrames, 90);
  assert.equal(draft.props.orientation, "vertical");
});

test("malformed JSON reports validation issues rather than TypeErrors", () => {
  for (const rooms of [null, {}, "rooms", [null], [1]]) {
    assert.throws(() => walkthroughMetadata("horizontal")({ props: { ...example(), rooms } }), /Walkthrough-Konfiguration ungültig/);
  }
  for (const title of [null, 7, []]) assert.ok(errors({ ...example(), title }).length);
  for (const value of [null, "fade", []]) {
    const p = example();p.rooms[0].transitionToNext = value;
    assert.ok(errors(p).length);
  }
});

test("music volume and subframe intro/endcard values are rejected", () => {
  for (const volume of [-1, 2, "loud", NaN]) {
    assert.ok(errors({ ...example(), music: { src: "walkthrough/music.wav", volume } }).length);
  }
  assert.ok(errors({ ...example(), introSec: 0.001 }).length);
  assert.ok(errors({ ...example(), endCardSec: 0.001 }).length);
});
