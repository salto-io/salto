/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import * as diff3 from '@salto-io/node-diff3'
import { ElemID, ReferenceExpression, StaticFile } from '@salto-io/adapter-api'
import { mergeLists, mergeStaticFiles, mergeStrings } from '../../src/core/merge_content'

jest.mock('@salto-io/node-diff3', () => ({
  __esModule: true,
  ...jest.requireActual<{}>('@salto-io/node-diff3'),
}))

describe('merge contents', () => {
  const changeId = 'salto.test'

  const base = 'hello world!\nmy name is:\nNaCls'
  const current = 'Hello World!\nmy name is:\nNaCls'
  const incomingMergeable = 'hello world!\nmy name is:\nNaCls the great!'
  const incomingMergeableWithDifferentLineTerminator =
    'hello world!\r\nmy name is:\r\nNaCls the great!\r\nthe great!\r\n'
  const incomingUnmergeable = 'HELLO WORLD!\nmy name is:\nNaCls the great!'
  const incomingAdded = 'my name is:\nNaCls\nthe great!'
  const incomingAddedWithDifferentLineTerminator = 'my name is:\r\nNaCls\r\nthe great!\r\nthe great!'

  const modifiedMerged = 'Hello World!\nmy name is:\nNaCls the great!'
  const modifiedMergedWithMixedLineTerminators = 'Hello World!\nmy name is:\nNaCls the great!\r\nthe great!\r\n'
  const addedMerged = 'Hello World!\nmy name is:\nNaCls\nthe great!'
  const addedMergedWithMixedLineTerminators = 'Hello World!\nmy name is:\nNaCls\nthe great!\r\nthe great!'

  describe('merge strings', () => {
    it('should merge modified value', () => {
      expect(mergeStrings(changeId, { current, base, incoming: incomingMergeable })).toEqual(modifiedMerged)
    })
    it('should merge added value', () => {
      expect(mergeStrings(changeId, { current, base: undefined, incoming: incomingAdded })).toEqual(addedMerged)
    })
    it('should merge modified value with different line terminator', () => {
      expect(mergeStrings(changeId, { current, base, incoming: incomingMergeableWithDifferentLineTerminator })).toEqual(
        modifiedMergedWithMixedLineTerminators,
      )
    })
    it('should merge added value with different line terminator', () => {
      expect(
        mergeStrings(changeId, { current, base: undefined, incoming: incomingAddedWithDifferentLineTerminator }),
      ).toEqual(addedMergedWithMixedLineTerminators)
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

  describe('merge lists', () => {
    describe('list of primitives', () => {
      const baseList = [1, 2, 3]
      const currentList = [1, 2, 3, 4]
      const incomingMergeableList = [0, 2, 1, 3]
      const incomingUnmergeableList = [1, 2, 3, 5]
      const incomingAddedList = [0, 1, 2, 5, 3]

      const modifiedMergedList = [0, 2, 1, 3, 4]
      const addedMergedList = [0, 1, 2, 5, 3, 4]

      it('should merge modified list', () => {
        expect(mergeLists(changeId, { current: currentList, base: baseList, incoming: incomingMergeableList })).toEqual(
          modifiedMergedList,
        )
      })
      it('should merge added list', () => {
        expect(mergeLists(changeId, { current: currentList, base: undefined, incoming: incomingAddedList })).toEqual(
          addedMergedList,
        )
      })
      it('should not merge unmergeable modified list', () => {
        expect(
          mergeLists(changeId, { current: currentList, base: baseList, incoming: incomingUnmergeableList }),
        ).toBeUndefined()
      })
      it('should not merge unmergeable added list', () => {
        expect(
          mergeLists(changeId, { current: currentList, base: undefined, incoming: incomingUnmergeableList }),
        ).toBeUndefined()
      })
    })
    describe('list of references', () => {
      const baseList = [
        new ReferenceExpression(new ElemID('salto', 'test1'), 1),
        new ReferenceExpression(new ElemID('salto', 'test2'), 2),
        new ReferenceExpression(new ElemID('salto', 'test3'), 3),
      ]
      const currentList = [
        new ReferenceExpression(new ElemID('salto', 'test1'), 1.1),
        new ReferenceExpression(new ElemID('salto', 'test2'), 2.2),
        new ReferenceExpression(new ElemID('salto', 'test3'), 3.3),
        new ReferenceExpression(new ElemID('salto', 'test4'), 4.4),
      ]
      const incomingMergeableList = [
        new ReferenceExpression(new ElemID('salto', 'test0'), 0),
        new ReferenceExpression(new ElemID('salto', 'test2'), 2.5),
        new ReferenceExpression(new ElemID('salto', 'test1'), 1.5),
        new ReferenceExpression(new ElemID('salto', 'test3'), 3.5),
      ]
      const incomingUnmergeableList = [
        new ReferenceExpression(new ElemID('salto', 'test1'), 1.5),
        new ReferenceExpression(new ElemID('salto', 'test2'), 2.5),
        new ReferenceExpression(new ElemID('salto', 'test3'), 3.5),
        new ReferenceExpression(new ElemID('salto', 'test5'), 5.5),
      ]
      const incomingAddedList = [
        new ReferenceExpression(new ElemID('salto', 'test0'), 0),
        new ReferenceExpression(new ElemID('salto', 'test1'), 1.5),
        new ReferenceExpression(new ElemID('salto', 'test2'), 2.5),
        new ReferenceExpression(new ElemID('salto', 'test5'), 5.5),
        new ReferenceExpression(new ElemID('salto', 'test3'), 3.5),
      ]

      const modifiedMergedList = [
        new ReferenceExpression(new ElemID('salto', 'test0'), expect.any(Number)),
        new ReferenceExpression(new ElemID('salto', 'test2'), expect.any(Number)),
        new ReferenceExpression(new ElemID('salto', 'test1'), expect.any(Number)),
        new ReferenceExpression(new ElemID('salto', 'test3'), expect.any(Number)),
        new ReferenceExpression(new ElemID('salto', 'test4'), expect.any(Number)),
      ]
      const addedMergedList = [
        new ReferenceExpression(new ElemID('salto', 'test0'), expect.any(Number)),
        new ReferenceExpression(new ElemID('salto', 'test1'), expect.any(Number)),
        new ReferenceExpression(new ElemID('salto', 'test2'), expect.any(Number)),
        new ReferenceExpression(new ElemID('salto', 'test5'), expect.any(Number)),
        new ReferenceExpression(new ElemID('salto', 'test3'), expect.any(Number)),
        new ReferenceExpression(new ElemID('salto', 'test4'), expect.any(Number)),
      ]

      it('should merge modified list', () => {
        expect(mergeLists(changeId, { current: currentList, base: baseList, incoming: incomingMergeableList })).toEqual(
          modifiedMergedList,
        )
      })
      it('should merge added list', () => {
        expect(mergeLists(changeId, { current: currentList, base: undefined, incoming: incomingAddedList })).toEqual(
          addedMergedList,
        )
      })
      it('should not merge unmergeable modified list', () => {
        expect(
          mergeLists(changeId, { current: currentList, base: baseList, incoming: incomingUnmergeableList }),
        ).toBeUndefined()
      })
      it('should not merge unmergeable added list', () => {
        expect(
          mergeLists(changeId, { current: currentList, base: undefined, incoming: incomingUnmergeableList }),
        ).toBeUndefined()
      })
    })
    describe('list of objects', () => {
      const baseList = [{ num: 1 }, { num: 2 }, { num: 3 }]
      const currentList = [{ num: 1 }, { num: 2 }, { num: 3 }, { num: 4 }]
      const incomingMergeableList = [{ num: 0 }, { num: 1, inner: [1, 2] }, { num: 2 }, { num: 3 }]
      const incomingUnmergeableList = [{ num: 1 }, { num: 2 }, { num: 3 }, { num: 4, inner: [1, 2] }]
      const incomingAddedList = [{ num: 0 }, { num: 1 }, { num: 2 }, { num: 5 }, { num: 3 }]

      const modifiedMergedList = [{ num: 0 }, { num: 1, inner: [1, 2] }, { num: 2 }, { num: 3 }, { num: 4 }]
      const addedMergedList = [{ num: 0 }, { num: 1 }, { num: 2 }, { num: 5 }, { num: 3 }, { num: 4 }]

      it('should merge modified list', () => {
        expect(mergeLists(changeId, { current: currentList, base: baseList, incoming: incomingMergeableList })).toEqual(
          modifiedMergedList,
        )
      })
      it('should merge added list', () => {
        expect(mergeLists(changeId, { current: currentList, base: undefined, incoming: incomingAddedList })).toEqual(
          addedMergedList,
        )
      })
      it('should not merge unmergeable modified list', () => {
        expect(
          mergeLists(changeId, { current: currentList, base: baseList, incoming: incomingUnmergeableList }),
        ).toBeUndefined()
      })
      it('should not merge unmergeable added list', () => {
        expect(
          mergeLists(changeId, { current: currentList, base: undefined, incoming: incomingUnmergeableList }),
        ).toBeUndefined()
      })
    })
  })
})
