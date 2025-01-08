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
} from '@salto-io/adapter-api'
import { Workspace } from '@salto-io/workspace'
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

const { awu } = collections.asynciterable

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

  let mockAdapter: ReturnType<typeof createMockAdapter>
  let workspace: Workspace
  beforeEach(() => {
    mockAdapter = createMockAdapter(mockAdapterName)
    mockAdapterCreator[mockAdapterName] = mockAdapter

    workspace = mockWorkspace({
      elements: [type, instanceWithHidden, instanceNacl],
      elementsWithoutHidden: [type, instance, instanceNacl],
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
      const afterNewInstance = new InstanceElement('instance2', type, { f: 'v' })
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

    let workspace: Workspace
    beforeEach(() => {
      const type = new ObjectType({ elemID: new ElemID(mockAdapterName, 'type') })
      separateInstanceInFolder = new InstanceElement('folderInst', type, { value: 'folder' })
      separateInstanceInWorkspace = new InstanceElement('workspaceInst', type, { value: 'ws' })
      sameInstanceInFolder = new InstanceElement('sameInst', type, { value: 'folder' })
      sameInstanceInWorkspace = new InstanceElement('sameInst', type, { value: 'ws' })
      hiddenElementInWorkspace = new InstanceElement('hiddenInst', type, { value: 'test' }, undefined, {
        [CORE_ANNOTATIONS.HIDDEN]: true,
      })

      const workspaceElements = [type, separateInstanceInWorkspace, sameInstanceInWorkspace, hiddenElementInWorkspace]
      const folderElements = [type, separateInstanceInFolder, sameInstanceInFolder]

      workspace = mockWorkspace({
        elements: workspaceElements,
        name: 'workspace',
        accounts: [mockAdapterName],
        accountToServiceName: { [mockAdapterName]: mockAdapterName },
      })
      mockAdapter.adapterFormat.loadElementsFromFolder.mockResolvedValue({ elements: folderElements })
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
  let changes: ReadonlyArray<Change>
  let visibleChanges: ReadonlyArray<Change>

  const unresolved = (instance: InstanceElement): InstanceElement =>
    new InstanceElement(instance.elemID.name, new TypeReference(instance.getTypeSync().elemID), instance.value)

  beforeEach(() => {
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
    const unresolvedVisibleChanges = [
      toChange({ after: unresolved(instance1) }),
      toChange({ before: unresolved(instance2) }),
      toChange({ before: unresolved(instance3Before), after: unresolved(instance3After) }),
      toChange({ after: type }),
    ]
    visibleChanges = [
      toChange({ after: instance1 }),
      toChange({ before: instance2 }),
      toChange({ before: instance3Before, after: instance3After }),
      toChange({ after: type }),
    ]
    changes = unresolvedVisibleChanges.concat([toChange({ after: hiddenInstance })])
    workspace = mockWorkspace({
      name: 'workspace',
      elements: [instance1, instance2, type],
      accountToServiceName: { [mockAdapterName]: mockAdapterName },
    })
  })

  afterEach(() => {
    delete mockAdapterCreator[mockAdapterName]
  })

  describe('when called with valid parameters', () => {
    beforeEach(async () => {
      await updateElementFolder({
        changes,
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
        changes,
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
        changes,
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
        changes,
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
