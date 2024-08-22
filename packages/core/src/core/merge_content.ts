/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import * as diff3 from '@salto-io/node-diff3'
import { isBinary } from 'istextorbinary'
import { logger } from '@salto-io/logging'
import { strings } from '@salto-io/lowerdash'
import { StaticFile, Value } from '@salto-io/adapter-api'
import { getListItemExactKey } from '@salto-io/adapter-utils'

const log = logger(module)
const { humanFileSize } = strings

const MAX_MERGE_CONTENT_SIZE = 10 * 1024 * 1024
const MAX_MERGE_LIST_LENGTH = 10_000
const MERGE_TIMEOUT = 10 * 1000

type LineWithTerminator = string & { terminator: string }

const splitToLinesWithTerminators = (multilineString: string): LineWithTerminator[] => {
  const linesWithTerminators: LineWithTerminator[] = []
  let currentLine = ''

  for (let i = 0; i < multilineString.length; i += 1) {
    const char = multilineString[i]
    const nextChar = multilineString[i + 1]

    if (char === '\r' && nextChar === '\n') {
      // Windows style \r\n
      linesWithTerminators.push(Object.assign(currentLine, { terminator: '\r\n' }))
      currentLine = ''
      i += 1 // Skip the \n part
    } else if (char === '\r' || char === '\n') {
      // Other terminators: \r, \n. In general, \u2028 & \u2029 are considered line terminators too,
      // but Monaco Editor doesn't treat them as so (shows an unknown char), so we can ignore them too.
      linesWithTerminators.push(Object.assign(currentLine, { terminator: char }))
      currentLine = ''
    } else {
      currentLine += char
    }
  }

  // Add the last line if there is no terminator at the end
  if (currentLine !== '') {
    linesWithTerminators.push(Object.assign(currentLine, { terminator: '' }))
  }

  return linesWithTerminators
}

const joinLinesWithTerminators = (lines: LineWithTerminator[]): string =>
  lines.reduce((res, line, i) => {
    if (line.terminator === '' && i < lines.length - 1) {
      // in case that it's the last line of current/base/incoming, but there are more lines in the merged version
      // we want to use previous non-empty line terminator.
      const terminator = _.findLast(lines, l => l.terminator !== '', i - 1)?.terminator ?? '\n'
      return res.concat(line, terminator)
    }
    return res.concat(line, line.terminator ?? '\n')
  }, '')

const isConflictChunk = (chunk: diff3.ICommResult<string>): boolean =>
  !('common' in chunk) && chunk.buffer1.length > 0 && chunk.buffer2.length > 0

const mergeDiff2 = <T extends string>(first: T[], second: T[], timeout: number): { conflict: boolean; result: T[] } => {
  const result = diff3.diffComm(first, second, timeout)
  if (result.some(isConflictChunk)) {
    return { conflict: true, result: [] }
  }
  return {
    conflict: false,
    result: result.flatMap(chunk => ('common' in chunk ? chunk.common : chunk.buffer1.concat(chunk.buffer2))),
  }
}

const mergeDiff = <T extends string>(
  changeId: string,
  {
    current,
    base,
    incoming,
  }: {
    current: T[]
    base: T[] | undefined
    incoming: T[]
  },
): T[] | undefined =>
  log.timeDebug(
    () => {
      try {
        const { conflict, result } =
          base !== undefined
            ? diff3.mergeDiff3(current, base, incoming, { excludeFalseConflicts: true }, MERGE_TIMEOUT)
            : mergeDiff2(current, incoming, MERGE_TIMEOUT)
        if (conflict) {
          log.debug('conflict found in %s', changeId)
        } else {
          log.debug('merged %s successfully', changeId)
          return result as T[]
        }
      } catch (e) {
        if (e instanceof diff3.TimeoutError) {
          log.warn('merging %s reached timeout', changeId)
        } else {
          log.warn('merging %s failed with error %o', changeId, e)
        }
      }
      return undefined
    },
    'mergeDiff for %s',
    changeId,
  )

export const mergeStrings = (
  changeId: string,
  {
    current,
    base,
    incoming,
  }: {
    current: string
    base: string | undefined
    incoming: string
  },
): string | undefined => {
  const contents = [current, base ?? '', incoming]
  log.debug(
    'trying to merge contents of %s - sizes: %s',
    changeId,
    contents.map(item => humanFileSize(item.length)).join(', '),
  )
  if (contents.some(item => item.length > MAX_MERGE_CONTENT_SIZE)) {
    log.warn('skipping merge since contents size has reached the limit of %s', humanFileSize(MAX_MERGE_CONTENT_SIZE))
    return undefined
  }
  const merged = mergeDiff(changeId, {
    current: splitToLinesWithTerminators(current),
    base: base !== undefined ? splitToLinesWithTerminators(base) : undefined,
    incoming: splitToLinesWithTerminators(incoming),
  })
  return merged !== undefined ? joinLinesWithTerminators(merged) : undefined
}

export const mergeStaticFiles = async (
  changeId: string,
  {
    current,
    base,
    incoming,
  }: {
    current: StaticFile
    base: StaticFile | undefined
    incoming: StaticFile
  },
): Promise<StaticFile | undefined> => {
  const { filepath, encoding } = current
  if (
    incoming.encoding !== encoding ||
    incoming.filepath !== filepath ||
    (base !== undefined && (base.encoding !== encoding || base.filepath !== filepath))
  ) {
    log.debug('skipping merge of %s since static files filepath & encoding does not match', changeId)
    return undefined
  }
  const isBinaryFilepath = isBinary(filepath)
  if (isBinaryFilepath) {
    log.debug('skipping merge of %s since the file extension of %s indicates binary file', changeId, filepath)
    return undefined
  }
  const currentBuffer = await current.getContent()
  const incomingBuffer = await incoming.getContent()
  const baseBuffer = base !== undefined ? await base.getContent() : null
  if (currentBuffer === undefined || incomingBuffer === undefined || baseBuffer === undefined) {
    log.warn('skipping merge of %s since some static file contents are missing', changeId)
    return undefined
  }
  if (
    isBinaryFilepath === null &&
    (isBinary(null, currentBuffer) || isBinary(null, incomingBuffer) || isBinary(null, baseBuffer))
  ) {
    log.debug('skipping merge of %s since some static file contents are binary', changeId)
    return undefined
  }
  const merged = mergeStrings(changeId, {
    current: currentBuffer.toString(encoding),
    base: baseBuffer?.toString(encoding),
    incoming: incomingBuffer.toString(encoding),
  })
  return merged !== undefined
    ? new StaticFile({ filepath, encoding, content: Buffer.from(merged, encoding) })
    : undefined
}

const toHashedListItems = (list: Value[]): { hashedList: string[]; hashToItemMap: Record<string, Value> } =>
  log.timeDebug(
    () => {
      const hashedList = list.map(getListItemExactKey)
      return {
        hashedList,
        hashToItemMap: Object.fromEntries(list.map((item, index) => [hashedList[index], item])),
      }
    },
    'hashing list with %d items',
    list.length,
  )

export const mergeLists = (
  changeId: string,
  {
    current: currentList,
    base: baseList,
    incoming: incomingList,
  }: {
    current: Value[]
    base: Value[] | undefined
    incoming: Value[]
  },
): Value[] | undefined => {
  const lists = [currentList, baseList ?? [], incomingList]
  log.debug('trying to merge list items of %s - lists length: %s', changeId, lists.map(item => item.length).join(', '))
  if (lists.some(item => item.length > MAX_MERGE_LIST_LENGTH)) {
    log.warn('skipping merge since lists length has reached the limit of %d', MAX_MERGE_LIST_LENGTH)
    return undefined
  }

  const current = toHashedListItems(currentList)
  const incoming = toHashedListItems(incomingList)
  const base = baseList !== undefined ? toHashedListItems(baseList) : undefined

  const merged = mergeDiff(changeId, {
    current: current.hashedList,
    base: base?.hashedList,
    incoming: incoming.hashedList,
  })

  if (merged === undefined) {
    return undefined
  }

  const mergedHashToItemMap = {
    ...current.hashToItemMap,
    ...incoming.hashToItemMap,
    ...base?.hashToItemMap,
  }

  return merged.map(itemHash => mergedHashToItemMap[itemHash])
}
