import type { Poll, PollAnswer } from "../context/TripContext";

/**
 * Polls the given user still has to answer. A poll counts as answered as soon
 * as the user has at least one `poll_answer` row for it, so this list shrinks
 * on its own as they pick options — no extra "seen" state to track. Order
 * follows the incoming `polls` array.
 */
export function unansweredPolls(args: {
  polls: Poll[];
  pollAnswers: PollAnswer[];
  userId: number;
}): Poll[] {
  const { polls, pollAnswers, userId } = args;
  const answered = new Set(
    pollAnswers
      .filter((a) => a.user_id === userId)
      .map((a) => a.poll_id)
  );
  return polls.filter((p) => !answered.has(p.id));
}
