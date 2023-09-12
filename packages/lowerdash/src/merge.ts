/*
*                      Copyright 2023 Salto Labs Ltd.
*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with
* the License.  You may obtain a copy of the License at
*
*     http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/


// The logic in this file is taken from https://github.com/bhousel/node-diff3/blob/v3.1.2/index.mjs

const LINE_BREAK = '\n'

const CURRENT_SECTION = '<<<<<<<'
const BASE_TOP_SECTION = '|||||||'
const BASE_BOTTOM_SECTION = '======='
const INCOMING_SECTION = '>>>>>>>'

type Candidate = {
  buffer1index: number
  buffer2index: number
  chain: Candidate | null
}

type Diff = {
  buffer1start: number
  buffer1length: number
  buffer2start: number
  buffer2length: number
}

type Hunk = {
  version: 'current' | 'incoming'
  baseStart: number
  baseLength: number
  diffStart: number
  diffLength: number
}

type Conflict = {
  current: string[]
  currentIndex: number
  base: string[]
  baseIndex: number
  incoming: string[]
  incomingIndex: number
}

type MergeBlock = {
  ok: string[]
} | {
  conflict: Conflict
}

export class ConflictError extends Error {
  constructor(conflict: Conflict) {
    super(`found a conflict: ${JSON.stringify(conflict, undefined, 2)}`)
  }
}

const getNextCandidateIndex = (
  currentCandidateIndex: number,
  candidates: Candidate[],
  buffer2index: number
): number => {
  const nextCandidateIndex = candidates
    .findIndex((candidate, index) =>
      index >= currentCandidateIndex
      && candidate.buffer2index < buffer2index
      && (index === candidates.length - 1 || candidates[index + 1].buffer2index > buffer2index))

  return nextCandidateIndex !== -1 ? nextCandidateIndex : candidates.length
}

const getLineIndices = (buffer: string[]): Record<string, number[]> =>
  buffer.reduce((lineIndices, line, index) => {
    if (lineIndices[line]) {
      lineIndices[line].push(index)
    } else {
      lineIndices[line] = [index]
    }
    return lineIndices
  }, {} as Record<string, number[]>)

// Text diff algorithm following Hunt and McIlroy 1976.
// J. W. Hunt and M. D. McIlroy, An algorithm for differential buffer
// comparison, Bell Telephone Laboratories CSTR #41 (1976)
// http://www.cs.dartmouth.edu/~doug/
// https://en.wikipedia.org/wiki/Longest_common_subsequence_problem
//
// Expects two arrays, finds longest common sequence - i.e. LCS
const getLongestCommonSequence = (buffer1: string[], buffer2: string[]): Candidate => {
  const buffer2LineIndices = getLineIndices(buffer2)
  const NULLRESULT: Candidate = { buffer1index: -1, buffer2index: -1, chain: null }
  const candidates = [NULLRESULT]

  buffer1.forEach((line, buffer1index) => {
    const buffer2CurrentLineIndices = buffer2LineIndices[line] || []

    const { candidate, index } = buffer2CurrentLineIndices.reduce((current, buffer2index) => {
      if (current.index === candidates.length) {
        return current
      }
      const nextCandidateIndex = getNextCandidateIndex(current.index, candidates, buffer2index)
      if (nextCandidateIndex === candidates.length) {
        return current
      }
      candidates[current.index] = current.candidate
      return {
        index: nextCandidateIndex + 1,
        candidate: {
          buffer1index,
          buffer2index,
          chain: candidates[nextCandidateIndex],
        },
      }
    }, { candidate: candidates[0], index: 0 })

    candidates[index] = candidate
  })

  // At this point, we know the LCS: it's in the reverse of the
  // linked-list through .chain of candidates[candidates.length - 1].

  return candidates[candidates.length - 1]
}

const candidatesChainToList = (candidate: Candidate | null): Candidate[] => {
  if (candidate === null) {
    return []
  }
  return [candidate, ...candidatesChainToList(candidate.chain)]
}

// We apply the LCS to give a simple representation of the
// offsets and lengths of mismatched chunks in the input
// buffers. This is used by diff3MergeRegions.
const getDiffIndices = (buffer1: string[], buffer2: string[]): Diff[] => {
  const lcs = getLongestCommonSequence(buffer1, buffer2)
  const result: Diff[] = []

  candidatesChainToList(lcs).reduce((prev, candidate) => {
    const mismatchLength1 = prev.buffer1index - candidate.buffer1index - 1
    const mismatchLength2 = prev.buffer2index - candidate.buffer2index - 1
    if (mismatchLength1 || mismatchLength2) {
      result.push({
        buffer1start: candidate.buffer1index + 1,
        buffer1length: mismatchLength1,
        buffer2start: candidate.buffer2index + 1,
        buffer2length: mismatchLength2,
      })
    }
    return candidate
  }, { buffer1index: buffer1.length, buffer2index: buffer2.length })

  return result.reverse()
}

// A "false conflict" is where `current` and `incoming` both change the same from `base`
const isFalseConflict = (buffer1: string[], buffer2: string[]): boolean => {
  if (buffer1.length !== buffer2.length) {
    return false
  }
  return buffer1.every((_v, i) => buffer1[i] === buffer2[i])
}

const toHunk = (block: Diff, version: 'current' | 'incoming'): Hunk => ({
  version,
  baseStart: block.buffer1start,
  baseLength: block.buffer1length,
  diffStart: block.buffer2start,
  diffLength: block.buffer2length,
})

// "hunks" are array subsets where `current` or `incoming` are different from `base`
// https://www.gnu.org/software/diffutils/manual/html_node/diff3-Hunks.html
const getHunks = ({
  current, base, incoming,
}: {
  current: string[]
  base: string[]
  incoming: string[]
}): Hunk[] => {
  const hunks = [
    ...getDiffIndices(base, current).map(item => toHunk(item, 'current')),
    ...getDiffIndices(base, incoming).map(item => toHunk(item, 'incoming')),
  ]
  return hunks.sort((x, y) => x.baseStart - y.baseStart)
}

const createMergeBlocksCursor = (base: string[]): {
  getMergeBlocks: () => MergeBlock[]
  pushBlock: (block: MergeBlock) => void
  setCurrentOffset: (offset: number) => void
  advanceTo: (endOffset: number) => void
} => {
  const results: MergeBlock[] = []
  let currOffset = 0

  return {
    getMergeBlocks: () => results,
    pushBlock: block => results.push(block),
    setCurrentOffset: offset => { currOffset = offset },
    advanceTo: endOffset => {
      if (endOffset > currOffset) {
        results.push({ ok: base.slice(currOffset, endOffset) })
        currOffset = endOffset
      }
    },
  }
}

const getRegionHunks = (hunks: Hunk[]): {
  regionHunks: Hunk[]
  regionStart: number
  regionEnd: number
} => {
  const hunk = hunks[0]
  hunks.shift()
  const regionHunks = [hunk]
  let regionEnd = hunk.baseStart + hunk.baseLength

  // Try to pull next overlapping hunk into this region
  while (hunks.length) {
    const nextHunk = hunks[0]
    const nextHunkStart = nextHunk.baseStart
    if (nextHunkStart > regionEnd) break // no overlap

    regionEnd = Math.max(regionEnd, nextHunkStart + nextHunk.baseLength)
    regionHunks.push(nextHunk)
    hunks.shift()
  }

  return { regionHunks, regionStart: hunk.baseStart, regionEnd }
}

// Given three buffers, `current`, `base`, and `incoming`, where both `current` and `incoming` are
// independently derived from `base`, returns a fairly complicated
// internal representation of merge decisions it's taken. The
// interested reader may wish to consult
//
// Sanjeev Khanna, Keshav Kunal, and Benjamin C. Pierce.
// 'A Formal Investigation of ' In Arvind and Prasad,
// editors, Foundations of Software Technology and Theoretical
// Computer Science (FSTTCS), December 2007.
//
// (http://www.cis.upenn.edu/~bcpierce/papers/diff3-short.pdf)
//
const diff3MergeBlocks = ({
  current, base, incoming, allowConflicts,
}: {
  current: string[]
  base: string[]
  incoming: string[]
  allowConflicts: boolean
}): MergeBlock[] => {
  const cursor = createMergeBlocksCursor(base)

  const hunks = getHunks({ current, base, incoming })
  while (hunks.length) {
    const { regionHunks, regionStart, regionEnd } = getRegionHunks(hunks)
    cursor.advanceTo(regionStart)

    if (regionHunks.length === 1) {
      // Only one hunk touches this region, meaning that there is no conflict here.
      // Either `current` or `incoming` is inserting into a region of `base` unchanged by the other.
      const hunk = regionHunks[0]
      if (hunk.diffLength > 0) {
        const buffer = hunk.version === 'current' ? current : incoming
        cursor.pushBlock({ ok: buffer.slice(hunk.diffStart, hunk.diffStart + hunk.diffLength) })
      }
    } else {
      // A true current/incoming conflict. Determine the bounds involved from `current`, `base`, and `incoming`.
      // Effectively merge all the `current` hunks into one giant hunk, then do the
      // same for the `incoming` hunks then, correct for skew in the regions of `base`
      // that each side changed, and report appropriate spans for the three sides.
      const bounds = regionHunks.reduce((accBounds, regionHunk) => {
        const acc = accBounds[regionHunk.version]
        return {
          ...accBounds,
          [regionHunk.version]: {
            diffStart: Math.min(regionHunk.diffStart, acc.diffStart),
            diffEnd: Math.max(regionHunk.diffStart + regionHunk.diffLength, acc.diffEnd),
            baseStart: Math.min(regionHunk.baseStart, acc.baseStart),
            baseEnd: Math.max(regionHunk.baseStart + regionHunk.baseLength, acc.baseEnd),
          },
        }
      }, {
        current: { diffStart: current.length, diffEnd: -1, baseStart: base.length, baseEnd: -1 },
        incoming: { diffStart: incoming.length, diffEnd: -1, baseStart: base.length, baseEnd: -1 },
      })

      const baseContent = base.slice(regionStart, regionEnd)

      const currentIndex = regionStart + bounds.current.diffStart - bounds.current.baseStart
      const currentEnd = regionEnd + bounds.current.diffEnd - bounds.current.baseEnd
      const currentContent = current.slice(currentIndex, currentEnd)

      const incomingIndex = regionStart + bounds.incoming.diffStart - bounds.incoming.baseStart
      const incomingEnd = regionEnd + bounds.incoming.diffEnd - bounds.incoming.baseEnd
      const incomingContent = incoming.slice(incomingIndex, incomingEnd)

      if (isFalseConflict(currentContent, incomingContent)) {
        cursor.pushBlock({ ok: currentContent })
      } else {
        const conflict = {
          currentIndex,
          current: currentContent,
          baseIndex: regionStart,
          base: baseContent,
          incomingIndex,
          incoming: incomingContent,
        }
        if (!allowConflicts) {
          throw new ConflictError(conflict)
        }
        cursor.pushBlock({ conflict })
      }
    }

    cursor.setCurrentOffset(regionEnd)
  }

  cursor.advanceTo(base.length)

  return cursor.getMergeBlocks()
}

const toConflictSection = (conflict: Conflict): string[] => [
  CURRENT_SECTION,
  ...conflict.current,
  BASE_TOP_SECTION,
  ...conflict.base,
  BASE_BOTTOM_SECTION,
  ...conflict.incoming,
  INCOMING_SECTION,
]

export const mergeDiffs = ({
  current, base, incoming, allowConflicts = false,
}: {
  current: string
  base: string
  incoming: string
  allowConflicts?: boolean
}): string => {
  const mergeBlocks = diff3MergeBlocks({
    current: current.split(LINE_BREAK),
    base: base.split(LINE_BREAK),
    incoming: incoming.split(LINE_BREAK),
    allowConflicts,
  })
  return mergeBlocks
    .flatMap(block => ('ok' in block ? block.ok : toConflictSection(block.conflict)))
    .join(LINE_BREAK)
}
