/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ObjectType,
  ElemID,
  BuiltinTypes,
  InstanceElement,
  Element,
  Adapter,
  toChange,
  SaltoError,
  Change,
  CORE_ANNOTATIONS,
  TypeReference,
  DetailedChangeWithBaseChange,
  getChangeData,
} from '@salto-io/adapter-api'
import { getDetailedChanges } from '@salto-io/adapter-utils'
import { Workspace, pathIndex, remoteMap } from '@salto-io/workspace'
import { collections } from '@salto-io/lowerdash'
import { mockWorkspace } from '../common/workspace'
import { createMockAdapter } from '../common/helpers'
import {
  calculatePatch,
  initFolder,
  isInitializedFolder,
  syncWorkspaceToFolder,
  SyncWorkspaceToFolderResult,
  updateElementFolder,
  UpdateElementFolderResult,
} from '../../src/core/adapter_format'
import { FetchResult } from '../../src/types'

const { awu } = collections.asynciterable

const toTestDetailedChanges = (changes: ReadonlyArray<Change>): DetailedChangeWithBaseChange[] =>
  changes.flatMap(change =>
    getDetailedChanges({
      originalId: getChangeData(change).elemID.getFullName(),
      detailedChanges: expect.anything(),
      ...change,
    } as unknown as Change),
  )

describe('isInitializedFolder', () => {
  const mockAdapterName = 'mock'
  const mockAdapterCreator: Record<string, Adapter> = {}

  let mockAdapter: ReturnType<typeof createMockAdapter>
  beforeEach(() => {
    mockAdapter = createMockAdapter(mockAdapterName)
    mockAdapterCreator[mockAdapterName] = mockAdapter
  })
  afterEach(() => {
    delete mockAdapterCreator[mockAdapterName]
  })

  describe('when adapter returns false', () => {
    beforeEach(() => {
      mockAdapter.adapterFormat.isInitializedFolder.mockResolvedValueOnce({ result: false, errors: [] })
    })

    it('should return false', async () => {
      const res = await isInitializedFolder({
        adapterName: mockAdapterName,
        baseDir: 'dir',
        adapterCreators: mockAdapterCreator,
      })
      expect(res.result).toBeFalse()
      expect(res.errors).toBeEmpty()
    })
  })

  describe('when adapter returns true', () => {
    beforeEach(() => {
      mockAdapter.adapterFormat.isInitializedFolder.mockResolvedValueOnce({ result: true, errors: [] })
    })

    it('should return true', async () => {
      const res = await isInitializedFolder({
        adapterName: mockAdapterName,
        baseDir: 'dir',
        adapterCreators: mockAdapterCreator,
      })
      expect(res.result).toBeTrue()
      expect(res.errors).toBeEmpty()
    })
  })

  describe('when adapter returns an error', () => {
    beforeEach(() => {
      mockAdapter.adapterFormat.isInitializedFolder.mockResolvedValueOnce({
        result: false,
        errors: [
          {
            severity: 'Error',
            message: 'Error message',
            detailedMessage: 'Detailed message',
          },
        ],
      })
    })

    it('should return an error', async () => {
      const res = await isInitializedFolder({
        adapterName: mockAdapterName,
        baseDir: 'dir',
        adapterCreators: mockAdapterCreator,
      })
      expect(res.result).toBeFalse()
      expect(res.errors).toEqual([
        {
          severity: 'Error',
          message: 'Error message',
          detailedMessage: 'Detailed message',
        },
      ])
    })
  })

  describe('when used with an account that does not support isInitializedFolder', () => {
    beforeEach(() => {
      delete (mockAdapter as Adapter).adapterFormat
    })

    it('should return an error', async () => {
      const res = await isInitializedFolder({
        adapterName: mockAdapterName,
        baseDir: 'dir',
        adapterCreators: mockAdapterCreator,
      })
      expect(res.errors).toEqual([
        {
          severity: 'Error',
          message: 'Format not supported',
          detailedMessage: `Adapter ${mockAdapterName} does not support checking a non-nacl format folder`,
        },
      ])
    })
  })
})

describe('initFolder', () => {
  const mockAdapterName = 'mock'
  const mockAdapterCreator: Record<string, Adapter> = {}
  let mockAdapter: ReturnType<typeof createMockAdapter>
  beforeEach(() => {
    mockAdapter = createMockAdapter(mockAdapterName)
    mockAdapterCreator[mockAdapterName] = mockAdapter
  })
  afterEach(() => {
    delete mockAdapterCreator[mockAdapterName]
  })

  describe('when adapter returns no errors', () => {
    beforeEach(() => {
      mockAdapter.adapterFormat.initFolder.mockResolvedValueOnce({ errors: [] })
    })

    it('should return no errors', async () => {
      const res = await initFolder({
        adapterName: mockAdapterName,
        baseDir: 'dir',
        adapterCreators: mockAdapterCreator,
      })
      expect(res.errors).toBeEmpty()
    })
  })

  describe('when adapter returns errors', () => {
    beforeEach(() => {
      mockAdapter.adapterFormat.initFolder.mockResolvedValueOnce({
        errors: [
          {
            severity: 'Error',
            message: 'Failed initializing adapter format folder',
            detailedMessage: 'Details on the error',
          },
        ],
      })
    })

    it('should return errors', async () => {
      const res = await initFolder({
        adapterName: mockAdapterName,
        baseDir: 'dir',
        adapterCreators: mockAdapterCreator,
      })
      expect(res.errors).toEqual([
        {
          severity: 'Error',
          message: 'Failed initializing adapter format folder',
          detailedMessage: 'Details on the error',
        },
      ])
    })
  })

  describe('when used with an account that does not support initFolder', () => {
    beforeEach(() => {
      delete (mockAdapter as Adapter).adapterFormat
    })

    it('should return an error', async () => {
      const res = await initFolder({
        adapterName: mockAdapterName,
        baseDir: 'dir',
        adapterCreators: mockAdapterCreator,
      })
      expect(res.errors).toEqual([
        {
          severity: 'Error',
          message: 'Format not supported',
          detailedMessage: `Adapter ${mockAdapterName} does not support initializing a non-nacl format folder`,
        },
      ])
    })
  })
})

describe('calculatePatch', () => {
  const mockAdapterName = 'mock'
  const mockAdapterCreator: Record<string, Adapter> = {}
  const type = new ObjectType({
    elemID: new ElemID(mockAdapterName, 'type'),
    fields: {
      f: { refType: BuiltinTypes.STRING },
    },
  })
  const instance = new InstanceElement('instance', type, { f: 'v' })
  const instanceWithHidden = new InstanceElement('instance', type, { f: 'v', _service_id: 123 })
  const instanceState = new InstanceElement('instanceState', type, { f: 'v' })
  const instanceNacl = instanceState.clone()
  instanceNacl.value.f = 'v2'

  const instance1 = new InstanceElement('instance1', type, { f: 'v' })
  const instance2 = new InstanceElement('instance2', type, { f: 'v' })
  const instance3 = new InstanceElement('instance3', type, { f: 'v' })

  let mockAdapter: ReturnType<typeof createMockAdapter>
  let workspace: Workspace
  beforeEach(() => {
    mockAdapter = createMockAdapter(mockAdapterName)
    mockAdapterCreator[mockAdapterName] = mockAdapter

    workspace = mockWorkspace({
      elements: [type, instanceWithHidden, instanceNacl, instance1, instance2, instance3],
      elementsWithoutHidden: [type, instance, instanceNacl, instance1, instance2, instance3],
      stateElements: [type, instanceWithHidden, instanceState],
      name: 'workspace',
      accounts: [mockAdapterName],
      accountToServiceName: { [mockAdapterName]: mockAdapterName },
    })
  })
  afterEach(() => {
    delete mockAdapterCreator[mockAdapterName]
  })

  describe('when there is a difference between the folders', () => {
    it('should return the changes with no errors', async () => {
      const afterModifyInstance = instance.clone()
      afterModifyInstance.value.f = 'v3'
      const afterNewInstance = new InstanceElement('instanceNew', type, { f: 'v' })
      const beforeElements = [instance]
      const afterElements = [afterModifyInstance, afterNewInstance]
      mockAdapter.adapterFormat.loadElementsFromFolder
        .mockResolvedValueOnce({ elements: beforeElements })
        .mockResolvedValueOnce({ elements: afterElements })
      const res = await calculatePatch({
        workspace,
        fromDir: 'before',
        toDir: 'after',
        accountName: mockAdapterName,
        adapterCreators: mockAdapterCreator,
      })
      expect(res.success).toBeTruthy()
      expect(res.fetchErrors).toHaveLength(0)
      expect(res.mergeErrors).toHaveLength(0)
      expect(res.changes).toHaveLength(2)
      expect(res.partiallyFetchedAccounts).toEqual(new Set(['mock']))
    })
  })

  describe('when there is a difference between the folders and workspaces', () => {
    let res: FetchResult

    const afterModifyInstance = instance.clone()
    afterModifyInstance.value.f = 'v3'
    const afterNewInstance = new InstanceElement('instanceNew', type, { f: 'v' })

    const beforeWorkspaceInstance = instance1.clone()
    const afterWorkspaceInstance = beforeWorkspaceInstance.clone()
    afterWorkspaceInstance.value.f = 'v2'
    const newWorkspaceInstance = new InstanceElement('instanceNewWorkspace', type, { f: 'v' })

    const beforeMovedFromFolderInstance = instance2.clone()
    const afterMovedToWorkspaceInstance = beforeMovedFromFolderInstance.clone()
    afterMovedToWorkspaceInstance.value.f = 'toWorkspace'

    const beforeMovedFromWorkspaceInstance = instance3.clone()
    const afterMovedToFolderInstance = beforeMovedFromWorkspaceInstance.clone()
    afterMovedToFolderInstance.value.f = 'toFolder'

    beforeEach(async () => {
      const beforeElements = [instance, beforeMovedFromFolderInstance]
      const afterElements = [afterModifyInstance, afterNewInstance, afterMovedToFolderInstance]

      const beforeWorkspaceElements = [beforeWorkspaceInstance, beforeMovedFromWorkspaceInstance]
      const afterWorkspaceElements = [afterWorkspaceInstance, newWorkspaceInstance, afterMovedToWorkspaceInstance]
      const beforeWorkspace = mockWorkspace({
        elements: beforeWorkspaceElements,
        name: 'workspace',
        accounts: [mockAdapterName],
        accountToServiceName: { [mockAdapterName]: mockAdapterName },
      })
      const afterWorkspace = mockWorkspace({
        elements: afterWorkspaceElements,
        name: 'workspace',
        accounts: [mockAdapterName],
        accountToServiceName: { [mockAdapterName]: mockAdapterName },
      })

      mockAdapter.adapterFormat.loadElementsFromFolder
        .mockResolvedValueOnce({ elements: beforeElements })
        .mockResolvedValueOnce({ elements: afterElements })
      res = await calculatePatch({
        workspace,
        fromDir: 'before',
        fromWorkspace: beforeWorkspace,
        toDir: 'after',
        toWorkspace: afterWorkspace,
        accountName: mockAdapterName,
        adapterCreators: mockAdapterCreator,
      })
    })
    it('should return success', () => {
      expect(res.success).toBeTruthy()
    })

    it('should return no errors', () => {
      expect(res.fetchErrors).toHaveLength(0)
      expect(res.mergeErrors).toHaveLength(0)
    })

    it('should return changes between elements in the folders', () => {
      expect(res.changes.map(change => change.change)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: 'modify',
            id: afterModifyInstance.elemID.createNestedID('f'),
          }),
          expect.objectContaining({
            action: 'add',
            id: afterNewInstance.elemID,
          }),
        ]),
      )
    })
    it('should return changes between elements in the workspaces', () => {
      expect(res.changes.map(change => change.change)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: 'modify',
            data: { after: 'v2', before: 'v' },
            id: beforeWorkspaceInstance.elemID.createNestedID('f'),
          }),
          expect.objectContaining({
            action: 'add',
            id: newWorkspaceInstance.elemID,
          }),
        ]),
      )
    })

    it('should return changes between elements in folder before and workspace after', () => {
      expect(res.changes.map(change => change.change)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: 'modify',
            data: { after: 'toWorkspace', before: 'v' },
            id: beforeMovedFromFolderInstance.elemID.createNestedID('f'),
          }),
        ]),
      )
    })
    it('should return changes between elements in workspace before and folder after', () => {
      expect(res.changes.map(change => change.change)).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            action: 'modify',
            data: { after: 'toFolder', before: 'v' },
            id: beforeMovedFromWorkspaceInstance.elemID.createNestedID('f'),
          }),
        ]),
      )
    })
  })

  describe('when an element is added and also exists in ws', () => {
    it('should not return changes for hidden values', async () => {
      const afterModifyInstance = instance.clone()
      afterModifyInstance.value.f = 'v3'
      const beforeElements: Element[] = []
      const afterElements = [afterModifyInstance]
      mockAdapter.adapterFormat.loadElementsFromFolder
        .mockResolvedValueOnce({ elements: beforeElements })
        .mockResolvedValueOnce({ elements: afterElements })
      const res = await calculatePatch({
        workspace,
        fromDir: 'before',
        toDir: 'after',
        accountName: mockAdapterName,
        adapterCreators: mockAdapterCreator,
      })
      expect(res.success).toBeTruthy()
      expect(res.fetchErrors).toHaveLength(0)
      expect(res.mergeErrors).toHaveLength(0)
      expect(res.changes).toHaveLength(1)
      expect(res.changes[0].change.id.name).toEqual('f')
      expect(res.partiallyFetchedAccounts).toEqual(new Set(['mock']))
    })
  })

  describe('when there is no difference between the folders', () => {
    it('should return with no changes and no errors', async () => {
      const beforeElements = [instance]
      const afterElements = [instance]
      mockAdapter.adapterFormat.loadElementsFromFolder
        .mockResolvedValueOnce({ elements: beforeElements })
        .mockResolvedValueOnce({ elements: afterElements })
      const res = await calculatePatch({
        workspace,
        fromDir: 'before',
        toDir: 'after',
        accountName: mockAdapterName,
        adapterCreators: mockAdapterCreator,
      })
      expect(res.success).toBeTruthy()
      expect(res.fetchErrors).toHaveLength(0)
      expect(res.mergeErrors).toHaveLength(0)
      expect(res.changes).toHaveLength(0)
      expect(res.partiallyFetchedAccounts).toEqual(new Set(['mock']))
    })
  })

  describe('when there is a merge error', () => {
    it('should return with merge error and success false', async () => {
      const beforeElements = [instance, instance]
      mockAdapter.adapterFormat.loadElementsFromFolder.mockResolvedValueOnce({ elements: beforeElements })
      const res = await calculatePatch({
        workspace,
        fromDir: 'before',
        toDir: 'after',
        accountName: mockAdapterName,
        adapterCreators: mockAdapterCreator,
      })
      expect(res.success).toBeFalsy()
      expect(res.fetchErrors).toHaveLength(0)
      expect(res.changes).toHaveLength(0)
      expect(res.mergeErrors).toHaveLength(1)
      expect(res.partiallyFetchedAccounts).toEqual(new Set(['mock']))
    })
  })

  describe('when there is a fetch error', () => {
    it('should return with changes and fetch errors', async () => {
      const afterModifyInstance = instance.clone()
      afterModifyInstance.value.f = 'v3'
      const beforeElements = [instance]
      const afterElements = [afterModifyInstance]
      mockAdapter.adapterFormat.loadElementsFromFolder
        .mockResolvedValueOnce({ elements: beforeElements })
        .mockResolvedValueOnce({
          elements: afterElements,
          errors: [
            {
              message: 'err',
              severity: 'Warning',
              detailedMessage: 'err',
            },
          ],
        })
      const res = await calculatePatch({
        workspace,
        fromDir: 'before',
        toDir: 'after',
        accountName: mockAdapterName,
        adapterCreators: mockAdapterCreator,
      })
      expect(res.success).toBeTruthy()
      expect(res.changes).toHaveLength(1)
      expect(res.mergeErrors).toHaveLength(0)
      expect(res.fetchErrors).toHaveLength(1)
      expect(res.partiallyFetchedAccounts).toEqual(new Set(['mock']))
    })
  })

  describe('when there are conflicts', () => {
    it('should return the changes with pendingChanges', async () => {
      const beforeConflictInstance = instanceState.clone()
      beforeConflictInstance.value.f = 'v5'
      const afterConflictInstance = instanceState.clone()
      afterConflictInstance.value.f = 'v4'
      const beforeElements = [beforeConflictInstance]
      const afterElements = [afterConflictInstance]
      mockAdapter.adapterFormat.loadElementsFromFolder
        .mockResolvedValueOnce({ elements: beforeElements })
        .mockResolvedValueOnce({ elements: afterElements })
      const res = await calculatePatch({
        workspace,
        fromDir: 'before',
        toDir: 'after',
        accountName: mockAdapterName,
        adapterCreators: mockAdapterCreator,
      })
      expect(res.success).toBeTruthy()
      expect(res.fetchErrors).toHaveLength(0)
      expect(res.mergeErrors).toHaveLength(0)
      expect(res.changes).toHaveLength(1)
      const firstChange = (await awu(res.changes).toArray())[0]
      expect(firstChange.pendingChanges).toHaveLength(1)
      expect(res.partiallyFetchedAccounts).toEqual(new Set(['mock']))
    })
  })

  describe('when used with an account that does not support loadElementsFromFolder', () => {
    it('Should throw an error', async () => {
      delete (mockAdapter as Adapter).adapterFormat
      await expect(
        calculatePatch({
          workspace,
          fromDir: 'before',
          toDir: 'after',
          accountName: mockAdapterName,
          adapterCreators: mockAdapterCreator,
        }),
      ).rejects.toThrow()
    })
  })
})

describe('syncWorkspaceToFolder', () => {
  const mockAdapterName = 'mock'
  const mockAdapterCreator: Record<string, Adapter> = {}
  let mockAdapter: ReturnType<typeof createMockAdapter>

  beforeEach(() => {
    mockAdapter = createMockAdapter(mockAdapterName)
    mockAdapterCreator[mockAdapterName] = mockAdapter
  })
  afterEach(() => {
    delete mockAdapterCreator[mockAdapterName]
  })
  describe('when the folder has different elements from the workspace', () => {
    let separateInstanceInFolder: InstanceElement
    let separateInstanceInWorkspace: InstanceElement
    let sameInstanceInFolder: InstanceElement
    let sameInstanceInWorkspace: InstanceElement
    let hiddenElementInWorkspace: InstanceElement
    let unsupportedElementInToWorkspaceOnly: InstanceElement
    let unsupportedElementInFromWorkspaceOnly: InstanceElement
    let unsupportedElementInToWorkspace: InstanceElement
    let unsupportedElementInFromWorkspace: InstanceElement

    let workspace: Workspace
    let toWorkspace: Workspace
    beforeEach(async () => {
      const type = new ObjectType({ elemID: new ElemID(mockAdapterName, 'type') })
      separateInstanceInFolder = new InstanceElement('folderInst', type, { value: 'folder' })
      separateInstanceInWorkspace = new InstanceElement('workspaceInst', type, { value: 'ws' })
      sameInstanceInFolder = new InstanceElement('sameInst', type, { value: 'folder' })
      sameInstanceInWorkspace = new InstanceElement('sameInst', type, { value: 'ws' })
      hiddenElementInWorkspace = new InstanceElement('hiddenInst', type, { value: 'test' }, undefined, {
        [CORE_ANNOTATIONS.HIDDEN]: true,
      })

      const unsupportedType = new ObjectType({ elemID: new ElemID(mockAdapterName, 'unsupportedType') })
      unsupportedElementInFromWorkspace = new InstanceElement('unsupportedInst', unsupportedType, { value: 'from' })
      unsupportedElementInToWorkspace = new InstanceElement('unsupportedInst', unsupportedType, { value: 'to' })
      unsupportedElementInFromWorkspaceOnly = new InstanceElement(
        'unsupportedInstFromOnly',
        unsupportedType,
        {
          value: 'test',
        },
        ['salto', 'test'],
      )
      unsupportedElementInToWorkspaceOnly = new InstanceElement('unsupportedInstToOnly', unsupportedType, {
        value: 'test',
      })

      const workspaceElements = [
        type,
        separateInstanceInWorkspace,
        sameInstanceInWorkspace,
        hiddenElementInWorkspace,
        unsupportedElementInFromWorkspace,
        unsupportedElementInFromWorkspaceOnly,
      ]
      const folderElements = [type, separateInstanceInFolder, sameInstanceInFolder]

      const pi = new remoteMap.InMemoryRemoteMap<pathIndex.Path[]>()
      await pathIndex.updatePathIndex({
        pathIndex: pi,
        unmergedElements: workspaceElements,
      })
      workspace = mockWorkspace({
        elements: workspaceElements,
        name: 'workspace',
        accounts: [mockAdapterName],
        index: await awu(pi.entries()).toArray(),
        accountToServiceName: { [mockAdapterName]: mockAdapterName },
      })
      mockAdapter.adapterFormat.loadElementsFromFolder.mockResolvedValue({ elements: folderElements })

      const toWorkspaceElements = [type, unsupportedElementInToWorkspace, unsupportedElementInToWorkspaceOnly]
      toWorkspace = mockWorkspace({
        elements: toWorkspaceElements,
        name: 'workspace',
        accounts: [mockAdapterName],
        accountToServiceName: { [mockAdapterName]: mockAdapterName },
      })
    })
    describe('when adapter supports all required actions', () => {
      let result: SyncWorkspaceToFolderResult
      beforeEach(async () => {
        result = await syncWorkspaceToFolder({
          workspace,
          accountName: mockAdapterName,
          baseDir: 'dir',
          adapterCreators: mockAdapterCreator,
        })
      })
      it('should return no errors', () => {
        expect(result.errors).toBeEmpty()
      })
      it('should apply deletion changes for elements that exist in the folder and not the workspace', () => {
        expect(mockAdapter.adapterFormat.dumpElementsToFolder).toHaveBeenCalledWith({
          baseDir: 'dir',
          changes: expect.arrayContaining([expect.objectContaining(toChange({ before: separateInstanceInFolder }))]),
          elementsSource: expect.anything(),
        })
      })
      it('should apply modification changes for elements that exist in both the workspace and the folder', () => {
        // Note - we currently do not expect the function to filter out changes for elements that are identical
        expect(mockAdapter.adapterFormat.dumpElementsToFolder).toHaveBeenCalledWith({
          baseDir: 'dir',
          changes: expect.arrayContaining([
            expect.objectContaining(toChange({ before: sameInstanceInFolder, after: sameInstanceInWorkspace })),
          ]),
          elementsSource: expect.anything(),
        })
      })
      it('should apply addition changes for elements that exist in the workspace and not the folder', () => {
        expect(mockAdapter.adapterFormat.dumpElementsToFolder).toHaveBeenCalledWith({
          baseDir: 'dir',
          changes: expect.arrayContaining([expect.objectContaining(toChange({ after: separateInstanceInWorkspace }))]),
          elementsSource: expect.anything(),
        })
      })
      it('should not apply addition changes for hidden elements that exist in the workspace', () => {
        expect(mockAdapter.adapterFormat.dumpElementsToFolder).not.toHaveBeenCalledWith({
          baseDir: 'dir',
          changes: expect.arrayContaining([expect.objectContaining(toChange({ after: hiddenElementInWorkspace }))]),
          elementsSource: expect.anything(),
        })
      })
    })

    describe('when adapter supports all required actions and toWorkspace is provided', () => {
      let result: SyncWorkspaceToFolderResult
      beforeEach(async () => {
        mockAdapter.adapterFormat.dumpElementsToFolder.mockImplementationOnce(async ({ changes }) => ({
          errors: [],
          unappliedChanges: changes.filter(change => getChangeData(change).elemID.typeName === 'unsupportedType'),
        }))
        result = await syncWorkspaceToFolder({
          workspace,
          accountName: mockAdapterName,
          baseDir: 'dir',
          adapterCreators: mockAdapterCreator,
          toWorkspace,
        })
      })
      it('should return no errors', () => {
        expect(result.errors).toBeEmpty()
      })
      it('should apply deletion changes for unsupported elements that exist in the folder and not the to workspace', () => {
        expect(toWorkspace.updateNaclFiles).toHaveBeenCalledWith(
          expect.arrayContaining(toTestDetailedChanges([toChange({ before: unsupportedElementInToWorkspaceOnly })])),
        )
      })
      it('should apply modification changes for unsupported elements that exist in both the workspace and the to workspace', () => {
        expect(toWorkspace.updateNaclFiles).toHaveBeenCalledWith(
          expect.arrayContaining(
            toTestDetailedChanges([
              toChange({ before: unsupportedElementInToWorkspace, after: unsupportedElementInFromWorkspace }),
            ]),
          ),
        )
      })
      it('should apply addition changes for unsupported elements that exist in the workspace and not the to workspace', () => {
        expect(toWorkspace.updateNaclFiles).toHaveBeenCalledWith(
          expect.arrayContaining(getDetailedChanges(toChange({ after: unsupportedElementInFromWorkspaceOnly }))),
        )
      })
      it('should apply all addition changes with a correct path', () => {
        const mockUpdateNaclFiles = toWorkspace.updateNaclFiles as jest.MockedFunction<
          typeof toWorkspace.updateNaclFiles
        >
        const additionChanges = mockUpdateNaclFiles.mock.calls[0][0]
          .filter(change => change.action === 'add')
          .flatMap(change => getChangeData(change).path)
        expect(additionChanges).toEqual(['salto', 'test'])
      })
    })

    describe('when adapter does not support loading from folder', () => {
      let result: SyncWorkspaceToFolderResult
      beforeEach(async () => {
        delete (mockAdapter as Adapter).adapterFormat
        result = await syncWorkspaceToFolder({
          workspace,
          accountName: mockAdapterName,
          baseDir: 'dir',
          adapterCreators: mockAdapterCreator,
        })
      })
      it('should return an error', () => {
        expect(result.errors).toHaveLength(1)
        const [error] = result.errors
        expect(error).toHaveProperty('severity', 'Error')
      })
    })
    describe('when adapter does not support dumping to folder', () => {
      let result: SyncWorkspaceToFolderResult
      beforeEach(async () => {
        delete (mockAdapter as Adapter).adapterFormat
        result = await syncWorkspaceToFolder({
          workspace,
          accountName: mockAdapterName,
          baseDir: 'dir',
          adapterCreators: mockAdapterCreator,
        })
      })
      it('should return an error', () => {
        expect(result.errors).toHaveLength(1)
        const [error] = result.errors
        expect(error).toHaveProperty('severity', 'Error')
      })
    })

    describe('when loading elements from folder returns an error', () => {
      let result: SyncWorkspaceToFolderResult
      let errors: SaltoError[]
      beforeEach(async () => {
        errors = [{ severity: 'Error', message: 'something failed', detailedMessage: 'something failed' }]
        mockAdapter.adapterFormat.loadElementsFromFolder.mockResolvedValue({ elements: [], errors })
        result = await syncWorkspaceToFolder({
          workspace,
          accountName: mockAdapterName,
          baseDir: 'dir',
          adapterCreators: mockAdapterCreator,
        })
      })
      it('should return the error without trying to update the folder', () => {
        expect(result.errors).toEqual(errors)
        expect(mockAdapter.adapterFormat.dumpElementsToFolder).not.toHaveBeenCalled()
      })
    })

    describe('when loading elements from folder returns elements that cannot be merged', () => {
      let result: SyncWorkspaceToFolderResult
      beforeEach(async () => {
        mockAdapter.adapterFormat.loadElementsFromFolder.mockResolvedValue({
          elements: [separateInstanceInFolder, separateInstanceInFolder],
        })
        result = await syncWorkspaceToFolder({
          workspace,
          accountName: mockAdapterName,
          baseDir: 'dir',
          adapterCreators: mockAdapterCreator,
        })
      })
      it('should return error without trying to update the folder', () => {
        expect(result.errors).not.toHaveLength(0)
        expect(mockAdapter.adapterFormat.dumpElementsToFolder).not.toHaveBeenCalled()
      })
    })

    describe('when dumping elements to folder returns an error', () => {
      let result: SyncWorkspaceToFolderResult
      let errors: SaltoError[]
      beforeEach(async () => {
        errors = [
          {
            severity: 'Error',
            message: 'something failed',
            detailedMessage: 'something failed',
          },
        ]
        mockAdapter.adapterFormat.dumpElementsToFolder.mockResolvedValue({ errors, unappliedChanges: [] })
        result = await syncWorkspaceToFolder({
          workspace,
          accountName: mockAdapterName,
          baseDir: 'dir',
          adapterCreators: mockAdapterCreator,
        })
      })
      it('should return the error in the result', () => {
        expect(result.errors).toEqual(errors)
      })
    })
  })
  describe('when the account name is not the same as the adapter name', () => {
    let result: Promise<SyncWorkspaceToFolderResult>
    beforeEach(() => {
      const accountName = 'account'
      const workspace = mockWorkspace({
        name: 'workspace',
        elements: [],
        accounts: [accountName],
        accountToServiceName: { [accountName]: mockAdapterName },
      })
      result = syncWorkspaceToFolder({ workspace, accountName, baseDir: 'dir', adapterCreators: mockAdapterCreator })
    })
    it('should throw an error', async () => {
      await expect(result).rejects.toThrow()
    })
  })
})

describe('updateElementFolder', () => {
  const mockAdapterName = 'mock'
  const mockAdapterCreator: Record<string, Adapter> = {}
  let mockAdapter: ReturnType<typeof createMockAdapter>
  let workspace: Workspace
  let toWorkspace: Workspace
  let allChanges: ReadonlyArray<Change>
  let visibleChanges: ReadonlyArray<Change>
  let unsupportedChange: Change
  let unsupportedChangeWithPath: Change

  const unresolved = (instance: InstanceElement): InstanceElement =>
    new InstanceElement(instance.elemID.name, new TypeReference(instance.getTypeSync().elemID), instance.value)

  beforeEach(async () => {
    mockAdapter = createMockAdapter(mockAdapterName)
    mockAdapterCreator[mockAdapterName] = mockAdapter

    const type = new ObjectType({
      elemID: new ElemID(mockAdapterName, 'type'),
      fields: {
        f: { refType: BuiltinTypes.STRING },
      },
    })

    const instance1 = new InstanceElement('instance1', type, { f: 'v1' })
    const instance2 = new InstanceElement('instance2', type, { f: 'v2' })
    const instance3Before = new InstanceElement('instance3', type, { f: 'before' })
    const instance3After = new InstanceElement('instance3', type, { f: 'after' })
    const hiddenInstance = new InstanceElement('hiddenInst', type, { f: 'v_hidden' }, undefined, {
      [CORE_ANNOTATIONS.HIDDEN]: true,
    })
    const unsupportedType = new ObjectType({ elemID: new ElemID(mockAdapterName, 'unsupportedType') })
    const unsupportedInstance = new InstanceElement('unsupportedInst', unsupportedType, { value: 'unsupported' })
    const unsupportedInstanceWithPath = new InstanceElement(
      'unsupportedInst',
      unsupportedType,
      { value: 'unsupported' },
      ['salto', 'test'],
    )

    const unresolvedVisibleChanges = [
      toChange({ after: unresolved(instance1) }),
      toChange({ before: unresolved(instance2) }),
      toChange({ before: unresolved(instance3Before), after: unresolved(instance3After) }),
      toChange({ after: type }),
      toChange({ after: unresolved(unsupportedInstance) }),
    ]

    visibleChanges = [
      toChange({ after: instance1 }),
      toChange({ before: instance2 }),
      toChange({ before: instance3Before, after: instance3After }),
      toChange({ after: type }),
      toChange({ after: unsupportedInstance }),
    ]

    unsupportedChange = toChange({ after: unsupportedInstance })
    unsupportedChangeWithPath = toChange({ after: unsupportedInstanceWithPath })

    allChanges = unresolvedVisibleChanges.concat([toChange({ after: hiddenInstance })])

    const workspaceElements = [instance1, instance2, type, unsupportedInstance, unsupportedInstanceWithPath]

    const pi = new remoteMap.InMemoryRemoteMap<pathIndex.Path[]>()
    await pathIndex.updatePathIndex({
      pathIndex: pi,
      unmergedElements: workspaceElements,
    })
    workspace = mockWorkspace({
      name: 'workspace',
      elements: workspaceElements,
      index: await awu(pi.entries()).toArray(),
      accountToServiceName: { [mockAdapterName]: mockAdapterName },
    })

    toWorkspace = mockWorkspace({
      name: 'workspace',
      elements: [],
      accounts: [mockAdapterName],
      accountToServiceName: { [mockAdapterName]: mockAdapterName },
    })
  })

  afterEach(() => {
    delete mockAdapterCreator[mockAdapterName]
  })

  describe('when called with valid parameters', () => {
    let result: UpdateElementFolderResult
    beforeEach(async () => {
      mockAdapter.adapterFormat.dumpElementsToFolder.mockImplementationOnce(async ({ changes }) => ({
        errors: [],
        unappliedChanges: changes.filter(change => getChangeData(change).elemID.typeName === 'unsupportedType'),
      }))
      result = await updateElementFolder({
        changes: allChanges,
        workspace,
        accountName: mockAdapterName,
        baseDir: 'dir',
        adapterCreators: mockAdapterCreator,
      })
    })

    it('should call dumpElementsToFolder with the correct parameters', async () => {
      expect(mockAdapter.adapterFormat.dumpElementsToFolder).toHaveBeenCalledWith({
        baseDir: 'dir',
        changes: visibleChanges,
        elementsSource: expect.anything(),
      })
    })

    it('should return no errors', () => {
      expect(result.errors).toBeEmpty()
    })

    it('should return the unapplied changes', () => {
      expect(result.unappliedChanges).toEqual([unsupportedChange])
    })
  })
  describe('when called with valid parameters and toWorkspace is provided', () => {
    let result: UpdateElementFolderResult
    beforeEach(async () => {
      mockAdapter.adapterFormat.dumpElementsToFolder.mockImplementationOnce(async ({ changes }) => ({
        errors: [],
        unappliedChanges: changes.filter(change => getChangeData(change).elemID.typeName === 'unsupportedType'),
      }))
      result = await updateElementFolder({
        changes: allChanges,
        workspace,
        toWorkspace,
        accountName: mockAdapterName,
        baseDir: 'dir',
        adapterCreators: mockAdapterCreator,
      })
    })

    it('should call dumpElementsToFolder with the correct parameters', async () => {
      expect(mockAdapter.adapterFormat.dumpElementsToFolder).toHaveBeenCalledWith({
        baseDir: 'dir',
        changes: visibleChanges,
        elementsSource: expect.anything(),
      })
    })

    it('should call updateNaclFiles with the correct parameters', async () => {
      expect(toWorkspace.updateNaclFiles).toHaveBeenCalledWith(getDetailedChanges(unsupportedChangeWithPath))
    })
    it('should apply all addition changes with a correct path', () => {
      const mockUpdateNaclFiles = toWorkspace.updateNaclFiles as jest.MockedFunction<typeof toWorkspace.updateNaclFiles>
      const additionChanges = mockUpdateNaclFiles.mock.calls[0][0]
        .filter(change => change.action === 'add')
        .flatMap(change => getChangeData(change).path)
      expect(additionChanges).toEqual(['salto', 'test'])
    })

    it('should return no errors', () => {
      expect(result.errors).toBeEmpty()
    })

    it('should return no unapplied changes', () => {
      expect(result.unappliedChanges).toBeEmpty()
    })
  })

  describe('when updating elements to folder returns an error', () => {
    let result: UpdateElementFolderResult
    let errors: SaltoError[]
    beforeEach(async () => {
      errors = [
        {
          severity: 'Error',
          message: 'something failed',
          detailedMessage: 'something failed',
        },
      ]
      mockAdapter.adapterFormat.dumpElementsToFolder.mockResolvedValue({ errors, unappliedChanges: [] })
      result = await updateElementFolder({
        changes: allChanges,
        workspace,
        accountName: mockAdapterName,
        baseDir: 'dir',
        adapterCreators: mockAdapterCreator,
      })
    })

    it('should return the error in the result', () => {
      expect(result.errors).toEqual(errors)
    })
  })

  describe('when used with an account that does not support dumpElementsToFolder', () => {
    let result: UpdateElementFolderResult
    it('should return an error', async () => {
      delete (mockAdapter as Adapter).adapterFormat
      result = await updateElementFolder({
        changes: allChanges,
        workspace,
        accountName: mockAdapterName,
        baseDir: 'dir',
        adapterCreators: mockAdapterCreator,
      })
      expect(result).toEqual({
        unappliedChanges: [],
        errors: [
          {
            detailedMessage: "Account mock's adapter does not support writing a non-nacl format",
            message: 'Format not supported',
            severity: 'Error',
          },
        ],
      })
    })
  })

  describe('when the account name is not the same as the adapter name', () => {
    let result: Promise<UpdateElementFolderResult>
    beforeEach(() => {
      const accountName = 'account'
      workspace = mockWorkspace({
        name: 'workspace',
        elements: [],
        accounts: [accountName],
        accountToServiceName: { [accountName]: mockAdapterName },
      })
      result = updateElementFolder({
        changes: allChanges,
        workspace,
        accountName,
        baseDir: 'dir',
        adapterCreators: mockAdapterCreator,
      })
    })
    it('should throw an error', async () => {
      await expect(result).rejects.toThrow()
    })
  })
})
