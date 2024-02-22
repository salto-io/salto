/*
 *                      Copyright 2024 Salto Labs Ltd.
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
import * as diff3 from '@salto-io/node-diff3'
import { isBinary } from 'istextorbinary'
import { logger } from '@salto-io/logging'
import { strings } from '@salto-io/lowerdash'
import { StaticFile } from '@salto-io/adapter-api'

const log = logger(module)
const { humanFileSize } = strings

const MAX_MERGE_CONTENT_SIZE = 10 * 1024 * 1024
const MERGE_TIMEOUT = 10 * 1000

const isConflictChunk = (chunk: diff3.ICommResult<string>): boolean =>
  !('common' in chunk) && chunk.buffer1.length > 0 && chunk.buffer2.length > 0

const mergeTwoStrings = (
  first: string,
  second: string,
  { stringSeparator }: { stringSeparator: string },
  timeout: number,
): { conflict: boolean; result: string[] } => {
  const result = diff3.diffComm(first.split(stringSeparator), second.split(stringSeparator), timeout)
  if (result.some(isConflictChunk)) {
    return { conflict: true, result: [] }
  }
  return {
    conflict: false,
    result: result.flatMap(chunk => ('common' in chunk ? chunk.common : chunk.buffer1.concat(chunk.buffer2))),
  }
}

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
): string | undefined =>
  log.time(
    () => {
      const contents = [current, base ?? '', incoming]
      log.debug(
        'trying to merge contents of %s - sizes: %s',
        changeId,
        contents.map(item => humanFileSize(item.length)).join(', '),
      )
      if (contents.some(item => item.length > MAX_MERGE_CONTENT_SIZE)) {
        log.warn(
          'skipping merge since contents size has reached the limit of %s',
          humanFileSize(MAX_MERGE_CONTENT_SIZE),
        )
        return undefined
      }
      const options = { excludeFalseConflicts: true, stringSeparator: '\n' }
      try {
        const { conflict, result } =
          base !== undefined
            ? diff3.mergeDiff3(current, base, incoming, options, MERGE_TIMEOUT)
            : mergeTwoStrings(current, incoming, options, MERGE_TIMEOUT)
        if (conflict) {
          log.debug('conflict found in %s', changeId)
        } else {
          log.debug('merged %s successfully', changeId)
          return result.join(options.stringSeparator)
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
    'mergeStrings for %s',
    changeId,
  )

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
