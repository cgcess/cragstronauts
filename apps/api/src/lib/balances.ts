export interface Expense {
  payer_user_id: number;
  amount_cents: number;
  splits: { user_id: number; amount_cents?: number }[];
}

export interface Settlement {
  from_user_id: number;
  to_user_id: number;
  amount_cents: number;
}

/**
 * Distribute `total` cents into `n` integer shares that sum exactly to `total`.
 * The first `total % n` shares get one extra cent.
 */
export function distributeEqual(total: number, n: number): number[] {
  const base = Math.floor(total / n);
  const remainder = total % n;
  return Array.from({ length: n }, (_, i) => base + (i < remainder ? 1 : 0));
}

/**
 * A directed debt graph: `edges.get(debtor).get(creditor)` is the positive
 * amount `debtor` owes `creditor`. Zero and empty entries are pruned so the
 * presence of a key always means a live debt.
 */
type DebtGraph = Map<number, Map<number, number>>;

function getEdge(edges: DebtGraph, from: number, to: number): number {
  return edges.get(from)?.get(to) ?? 0;
}

function setEdge(edges: DebtGraph, from: number, to: number, amount: number): void {
  let outgoing = edges.get(from);
  if (amount <= 0) {
    outgoing?.delete(to);
    if (outgoing && outgoing.size === 0) edges.delete(from);
    return;
  }
  if (!outgoing) {
    outgoing = new Map();
    edges.set(from, outgoing);
  }
  outgoing.set(to, amount);
}

function addEdge(edges: DebtGraph, from: number, to: number, amount: number): void {
  setEdge(edges, from, to, getEdge(edges, from, to) + amount);
}

/** Cancel opposing debts between `a` and `b` (only the smaller direction survives). */
function netPair(edges: DebtGraph, a: number, b: number): void {
  const ab = getEdge(edges, a, b);
  const ba = getEdge(edges, b, a);
  const common = Math.min(ab, ba);
  if (common > 0) {
    setEdge(edges, a, b, ab - common);
    setEdge(edges, b, a, ba - common);
  }
}

/**
 * Build the pairwise directed debt graph from raw expenses.
 * Each non-payer split member with a non-zero share owes the payer that share.
 * Shares are derived the same way the rest of the app does: explicit
 * `amount_cents` when present, else an equal split with remainder handling.
 */
function buildPairwiseDebts(expenses: Expense[]): DebtGraph {
  const edges: DebtGraph = new Map();

  for (const exp of expenses) {
    const n = exp.splits.length;
    if (n === 0) continue;
    const shares = distributeEqual(exp.amount_cents, n);

    exp.splits.forEach((s, i) => {
      const share = s.amount_cents != null ? s.amount_cents : shares[i];
      if (s.user_id === exp.payer_user_id) return;
      if (share === 0) return;
      addEdge(edges, s.user_id, exp.payer_user_id, share);
    });
  }

  return edges;
}

/** All users that appear as a debtor or a creditor, ascending. */
function allNodes(edges: DebtGraph): number[] {
  const nodes = new Set<number>();
  for (const [from, outgoing] of edges) {
    nodes.add(from);
    for (const to of outgoing.keys()) nodes.add(to);
  }
  return [...nodes].sort((a, b) => a - b);
}

/** Creditors that `node` owes, ascending by user id. */
function outNeighbors(edges: DebtGraph, node: number): number[] {
  return [...(edges.get(node)?.keys() ?? [])].sort((a, b) => a - b);
}

/** Debtors that owe `node`, ascending by user id. */
function inNeighbors(edges: DebtGraph, node: number): number[] {
  const result: number[] = [];
  for (const [from, outgoing] of edges) {
    if (outgoing.has(node)) result.push(from);
  }
  return result.sort((a, b) => a - b);
}

/**
 * Collapse genuine pass-through debts. A node that both owes someone and is
 * owed by someone is a middleman: route an incoming debt straight to one of its
 * creditors, decrementing both legs and creating (or netting) the shortcut edge.
 * Repeats until no node has both an incoming and an outgoing edge, i.e. the
 * graph is bipartite (pure debtors and pure creditors). Deterministic:
 * candidates and their neighbors are visited in ascending user-id order.
 */
function removeMiddlemen(edges: DebtGraph): void {
  for (;;) {
    let middleman: number | undefined;
    for (const node of allNodes(edges)) {
      const owes = (edges.get(node)?.size ?? 0) > 0;
      if (owes && inNeighbors(edges, node).length > 0) {
        middleman = node;
        break;
      }
    }
    if (middleman === undefined) break;

    const s = inNeighbors(edges, middleman)[0];
    const t = outNeighbors(edges, middleman)[0];
    const flow = Math.min(getEdge(edges, s, middleman), getEdge(edges, middleman, t));

    addEdge(edges, s, middleman, -flow);
    addEdge(edges, middleman, t, -flow);
    addEdge(edges, s, t, flow);
    netPair(edges, s, t);
  }
}

/**
 * Compute honest settlements.
 *
 * Policy: build the pairwise directed debts, net opposing pairs, then remove
 * middlemen only. This collapses real pass-through chains ("A pays for B, B
 * pays for C" ⇒ "C pays A") but never minimizes the number of transactions:
 * a pure creditor or pure debtor is never routed through, so nobody is ever
 * told to pay a stranger they share no expense chain with.
 */
export function computeSimplifiedBalances(expenses: Expense[]): Settlement[] {
  const edges = buildPairwiseDebts(expenses);

  // Net opposing pairs (mutual debts and settlements cancel out).
  const nodes = allNodes(edges);
  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      netPair(edges, nodes[i], nodes[j]);
    }
  }

  removeMiddlemen(edges);

  const result: Settlement[] = [];
  for (const from of [...edges.keys()].sort((a, b) => a - b)) {
    const outgoing = edges.get(from)!;
    for (const to of [...outgoing.keys()].sort((a, b) => a - b)) {
      result.push({ from_user_id: from, to_user_id: to, amount_cents: outgoing.get(to)! });
    }
  }
  return result;
}
