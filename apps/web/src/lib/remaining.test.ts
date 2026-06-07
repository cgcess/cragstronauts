import { describe, it, expect } from "vitest";
import { unansweredPolls } from "./remaining";
import type { Poll, PollAnswer } from "../context/TripContext";

const poll = (id: number): Poll => ({
  id,
  question: `Q${id}`,
  description: null,
  emoji: null,
  position: id,
  options: [
    { id: id * 10, label: "A", emoji: null, position: 0 },
    { id: id * 10 + 1, label: "B", emoji: null, position: 1 },
  ],
});

const answer = (pollId: number, userId: number): PollAnswer => ({
  id: pollId * 1000 + userId,
  poll_id: pollId,
  option_id: pollId * 10,
  user_id: userId,
  user_name: `user${userId}`,
});

describe("unansweredPolls", () => {
  const polls = [poll(1), poll(2), poll(3)];

  it("returns every poll when the user has no answers", () => {
    expect(
      unansweredPolls({ polls, pollAnswers: [], userId: 7 }).map((p) => p.id)
    ).toEqual([1, 2, 3]);
  });

  it("returns nothing once the user has answered them all", () => {
    const pollAnswers = [answer(1, 7), answer(2, 7), answer(3, 7)];
    expect(unansweredPolls({ polls, pollAnswers, userId: 7 })).toEqual([]);
  });

  it("returns only the polls the user has not answered, in order", () => {
    const pollAnswers = [answer(2, 7)];
    expect(
      unansweredPolls({ polls, pollAnswers, userId: 7 }).map((p) => p.id)
    ).toEqual([1, 3]);
  });

  it("ignores answers belonging to other users", () => {
    const pollAnswers = [answer(1, 99), answer(2, 99), answer(3, 99)];
    expect(
      unansweredPolls({ polls, pollAnswers, userId: 7 }).map((p) => p.id)
    ).toEqual([1, 2, 3]);
  });

  it("returns an empty list when there are no polls", () => {
    expect(
      unansweredPolls({ polls: [], pollAnswers: [], userId: 7 })
    ).toEqual([]);
  });
});
