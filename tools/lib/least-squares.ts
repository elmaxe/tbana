// Sparse weighted least squares for the tools that fit lines through anchors (build-heights,
// build-track-geometry): each row asks sum(c·x) = b with weight w, and the solution minimises
// sum(w²·(c·x − b)²).
//
// The normal equations are solved exactly by Cholesky. Each unknown is tied only to its
// neighbours along the track (and, for the plan, to the track beside it), so after numbering the
// unknowns along the lines (reverse Cuthill–McKee) the matrix is a narrow band, stored as each
// row's span from its first non-zero to the diagonal. (Conjugate gradients stalls here: the long,
// gentle bends a tunnel under a lake needs are the slowest thing for it to find.)
export interface Row { i: number[]; c: number[]; b: number; w: number }

export class LeastSquares {
  n: number;
  rows: Row[];
  private pos: Int32Array;
  private order: number[] = [];

  // The numbering is made from `rows`. solve() may add rows; those that tie unknowns these
  // don't tie widen the band and slow the solve, but the answer is still exact.
  constructor(n: number, rows: Row[]) {
    this.n = n;
    this.rows = rows;
    const nb: Set<number>[] = Array.from({ length: n }, () => new Set());
    for (const r of rows) for (const a of r.i) for (const b of r.i) if (a !== b) nb[a].add(b);
    const seen = new Uint8Array(n);
    // start each part of the network from an end of it, then visit by distance from there,
    // fewest neighbours first
    const byDegree = Array.from({ length: n }, (_, v) => v).sort((a, b) => nb[a].size - nb[b].size);
    for (const s0 of byDegree) {
      if (seen[s0]) continue;
      const part: number[] = [s0];
      seen[s0] = 1;
      for (let h = 0; h < part.length; h++) {
        for (const w of [...nb[part[h]]].sort((a, b) => nb[a].size - nb[b].size)) if (!seen[w]) { seen[w] = 1; part.push(w); }
      }
      this.order.push(...part.reverse());
    }
    this.pos = new Int32Array(n);
    this.order.forEach((v, k) => { this.pos[v] = k; });
  }

  solve(extra: Row[] = []) {
    const { n, pos, order } = this;
    const all = this.rows.concat(extra);
    // the matrix in the new numbering: first column of each row, and the row from there
    const first = new Int32Array(n).map((_, i) => i);
    for (const r of all) {
      const ps = r.i.map((v) => pos[v]), lo = Math.min(...ps);
      for (const q of ps) if (lo < first[q]) first[q] = lo;
    }
    const start = new Int32Array(n + 1);
    for (let i = 0; i < n; i++) start[i + 1] = start[i] + i - first[i] + 1;
    const L = new Float64Array(start[n]);
    const at = (i: number, j: number) => start[i] + j - first[i];
    const rhs = new Float64Array(n);
    for (const r of all) {
      const w2 = r.w * r.w;
      for (let a = 0; a < r.i.length; a++) {
        const pa = pos[r.i[a]];
        rhs[pa] += r.c[a] * r.b * w2;
        for (let b = 0; b < r.i.length; b++) {
          const pb = pos[r.i[b]];
          if (pb <= pa) L[at(pa, pb)] += r.c[a] * r.c[b] * w2;
        }
      }
    }
    // factor in place: L·Lᵀ
    for (let i = 0; i < n; i++) {
      for (let j = first[i]; j <= i; j++) {
        let sum = L[at(i, j)];
        for (let k = Math.max(first[i], first[j]); k < j; k++) sum -= L[at(i, k)] * L[at(j, k)];
        if (j < i) L[at(i, j)] = sum / L[at(j, j)];
        else {
          if (!(sum > 0)) throw new Error('the equations are singular');
          L[at(i, i)] = Math.sqrt(sum);
        }
      }
    }
    // L·u = rhs, then Lᵀ·x = u
    const x = rhs.slice();
    for (let i = 0; i < n; i++) {
      let sum = x[i];
      for (let k = first[i]; k < i; k++) sum -= L[at(i, k)] * x[k];
      x[i] = sum / L[at(i, i)];
    }
    for (let i = n - 1; i >= 0; i--) {
      x[i] /= L[at(i, i)];
      for (let k = first[i]; k < i; k++) x[k] -= L[at(i, k)] * x[i];
    }
    const y = new Float64Array(n);
    order.forEach((v, k) => { y[v] = x[k]; });
    return y;
  }
}
