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
import { StaticFile } from '@salto-io/adapter-api'
import { mergeStaticFiles, mergeStrings } from '../../src/core/merge_content'

jest.mock('@salto-io/node-diff3', () => ({
  __esModule: true,
  ...jest.requireActual<{}>('@salto-io/node-diff3'),
}))

describe('merge contents', () => {
  const changeId = 'salto.test'

  const base = 'hello world!\nmy name is:\nNaCls'
  const current = 'Hello World!\nmy name is:\nNaCls'
  const incomingMergeable = 'hello world!\nmy name is:\nNaCls the great!'
  const incomingUnmergeable = 'HELLO WORLD!\nmy name is:\nNaCls the great!'
  const incomingAdded = 'my name is:\nNaCls\nthe great!'

  const modifiedMerged = 'Hello World!\nmy name is:\nNaCls the great!'
  const addedMerged = 'Hello World!\nmy name is:\nNaCls\nthe great!'

  describe('merge strings', () => {
    it('should merge modified value', () => {
      expect(mergeStrings(changeId, { current, base, incoming: incomingMergeable })).toEqual(modifiedMerged)
    })
    it('should merge added value', () => {
      expect(mergeStrings(changeId, { current, base: undefined, incoming: incomingAdded })).toEqual(addedMerged)
    })
    it('should not merge unmergeable modified value', () => {
      expect(mergeStrings(changeId, { current, base, incoming: incomingUnmergeable })).toBeUndefined()
    })
    it('should not merge unmergeable added value', () => {
      expect(mergeStrings(changeId, { current, base: undefined, incoming: incomingUnmergeable })).toBeUndefined()
    })
    it('should not merge too long value', () => {
      const incomingTooLong = 'hello world!\nmy name is:\nNaCls the great!'.padEnd(10 * 1024 * 1024 + 1, '!')
      expect(mergeStrings(changeId, { current, base, incoming: incomingTooLong })).toBeUndefined()
    })
    it('should not merge on timeout error', () => {
      jest.spyOn(diff3, 'mergeDiff3').mockImplementationOnce(() => {
        throw new diff3.TimeoutError()
      })
      jest.spyOn(diff3, 'diffComm').mockImplementationOnce(() => {
        throw new diff3.TimeoutError()
      })
      expect(mergeStrings(changeId, { current, base, incoming: incomingMergeable })).toBeUndefined()
      expect(mergeStrings(changeId, { current, base: undefined, incoming: incomingAdded })).toBeUndefined()
    })
    it('should not merge on unknown error', () => {
      jest.spyOn(diff3, 'mergeDiff3').mockImplementationOnce(() => {
        throw new Error()
      })
      jest.spyOn(diff3, 'diffComm').mockImplementationOnce(() => {
        throw new Error()
      })
      expect(mergeStrings(changeId, { current, base, incoming: incomingMergeable })).toBeUndefined()
      expect(mergeStrings(changeId, { current, base: undefined, incoming: incomingAdded })).toBeUndefined()
    })
  })

  describe('merge static files', () => {
    const filepath = 'abc'
    const baseFile = new StaticFile({ filepath, content: Buffer.from(base) })
    const currentFile = new StaticFile({ filepath, content: Buffer.from(current) })
    const incomingMergeableFile = new StaticFile({ filepath, content: Buffer.from(incomingMergeable) })
    const incomingUnmergeableFile = new StaticFile({ filepath, content: Buffer.from(incomingUnmergeable) })
    const incomingAddedFile = new StaticFile({ filepath, content: Buffer.from(incomingAdded) })

    const modifiedMergedFile = new StaticFile({ filepath, content: Buffer.from(modifiedMerged) })
    const addedMergedFile = new StaticFile({ filepath, content: Buffer.from(addedMerged) })

    it('should merge modified file', async () => {
      expect(
        await mergeStaticFiles(changeId, { current: currentFile, base: baseFile, incoming: incomingMergeableFile }),
      ).toEqual(modifiedMergedFile)
    })
    it('should merge added file', async () => {
      expect(
        await mergeStaticFiles(changeId, { current: currentFile, base: undefined, incoming: incomingAddedFile }),
      ).toEqual(addedMergedFile)
    })
    it('should not merge unmergeable modified file', async () => {
      expect(
        await mergeStaticFiles(changeId, { current: currentFile, base: baseFile, incoming: incomingUnmergeableFile }),
      ).toBeUndefined()
    })
    it('should not merge unmergeable added file', async () => {
      expect(
        await mergeStaticFiles(changeId, { current: currentFile, base: undefined, incoming: incomingUnmergeableFile }),
      ).toBeUndefined()
    })
    it('should not merge if filepath not match', async () => {
      const mergeableFileOtherPath = new StaticFile({ filepath: 'def', content: Buffer.from(incomingMergeable) })
      expect(
        await mergeStaticFiles(changeId, { current: currentFile, base: baseFile, incoming: mergeableFileOtherPath }),
      ).toBeUndefined()
    })
    it('should not merge if filepath is binary', async () => {
      const binaryPath = `${filepath}.png`
      const baseBinaryPathFile = new StaticFile({ filepath: binaryPath, content: Buffer.from(base) })
      const currentBinaryPathFile = new StaticFile({ filepath: binaryPath, content: Buffer.from(current) })
      const incomingBinaryPathFile = new StaticFile({ filepath: binaryPath, content: Buffer.from(incomingMergeable) })
      expect(
        await mergeStaticFiles(changeId, {
          current: currentBinaryPathFile,
          base: baseBinaryPathFile,
          incoming: incomingBinaryPathFile,
        }),
      ).toBeUndefined()
    })
    it('should not merge if content is missing', async () => {
      const incomingNoContent = new StaticFile({ filepath, hash: '123' })
      expect(
        await mergeStaticFiles(changeId, { current: currentFile, base: baseFile, incoming: incomingNoContent }),
      ).toBeUndefined()
    })
    it('should not merge if content is binary', async () => {
      const binaryFileContent = new StaticFile({
        filepath,
        content: Buffer.concat([Buffer.from(incomingMergeable), Buffer.from([200])]),
      })
      expect(
        await mergeStaticFiles(changeId, { current: currentFile, base: baseFile, incoming: binaryFileContent }),
      ).toBeUndefined()
    })
  })
})
