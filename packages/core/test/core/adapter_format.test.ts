/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
} from '@salto-io/adapter-api'
import { Workspace } from '@salto-io/workspace'
import { collections } from '@salto-io/lowerdash'
import { adapterCreators } from '../../src/core/adapters'
import { mockWorkspace } from '../common/workspace'
import { createMockAdapter } from '../common/helpers'
import { calculatePatch, syncWorkspaceToFolder, SyncWorkspaceToFolderResult } from '../../src/core/adapter_format'

const { awu } = collections.asynciterable

describe('calculatePatch', () => {
  const mockAdapterName = 'mock'
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
    adapterCreators[mockAdapterName] = mockAdapter

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
    delete adapterCreators[mockAdapterName]
  })

  describe('when there is a difference between the folders', () => {
    it('should return the changes with no errors', async () => {
      const afterModifyInstance = instance.clone()
      afterModifyInstance.value.f = 'v3'
      const afterNewInstance = new InstanceElement('instance2', type, { f: 'v' })
      const beforeElements = [instance]
      const afterElements = [afterModifyInstance, afterNewInstance]
      mockAdapter.loadElementsFromFolder
        .mockResolvedValueOnce({ elements: beforeElements })
        .mockResolvedValueOnce({ elements: afterElements })
      const res = await calculatePatch({
        workspace,
        fromDir: 'before',
        toDir: 'after',
        accountName: mockAdapterName,
      })
      expect(res.success).toBeTruthy()
      expect(res.fetchErrors).toHaveLength(0)
      expect(res.mergeErrors).toHaveLength(0)
      expect(res.changes).toHaveLength(2)
    })
  })

  describe('when an element is added and also exists in ws', () => {
    it('should not return changes for hidden values', async () => {
      const afterModifyInstance = instance.clone()
      afterModifyInstance.value.f = 'v3'
      const beforeElements: Element[] = []
      const afterElements = [afterModifyInstance]
      mockAdapter.loadElementsFromFolder
        .mockResolvedValueOnce({ elements: beforeElements })
        .mockResolvedValueOnce({ elements: afterElements })
      const res = await calculatePatch({
        workspace,
        fromDir: 'before',
        toDir: 'after',
        accountName: mockAdapterName,
      })
      expect(res.success).toBeTruthy()
      expect(res.fetchErrors).toHaveLength(0)
      expect(res.mergeErrors).toHaveLength(0)
      expect(res.changes).toHaveLength(1)
      expect(res.changes[0].change.id.name).toEqual('f')
    })
  })

  describe('when there is no difference between the folders', () => {
    it('should return with no changes and no errors', async () => {
      const beforeElements = [instance]
      const afterElements = [instance]
      mockAdapter.loadElementsFromFolder
        .mockResolvedValueOnce({ elements: beforeElements })
        .mockResolvedValueOnce({ elements: afterElements })
      const res = await calculatePatch({
        workspace,
        fromDir: 'before',
        toDir: 'after',
        accountName: mockAdapterName,
      })
      expect(res.success).toBeTruthy()
      expect(res.fetchErrors).toHaveLength(0)
      expect(res.mergeErrors).toHaveLength(0)
      expect(res.changes).toHaveLength(0)
    })
  })

  describe('when there is a merge error', () => {
    it('should return with merge error and success false', async () => {
      const beforeElements = [instance, instance]
      mockAdapter.loadElementsFromFolder.mockResolvedValueOnce({ elements: beforeElements })
      const res = await calculatePatch({
        workspace,
        fromDir: 'before',
        toDir: 'after',
        accountName: mockAdapterName,
      })
      expect(res.success).toBeFalsy()
      expect(res.fetchErrors).toHaveLength(0)
      expect(res.changes).toHaveLength(0)
      expect(res.mergeErrors).toHaveLength(1)
    })
  })

  describe('when there is a fetch error', () => {
    it('should return with changes and fetch errors', async () => {
      const afterModifyInstance = instance.clone()
      afterModifyInstance.value.f = 'v3'
      const beforeElements = [instance]
      const afterElements = [afterModifyInstance]
      mockAdapter.loadElementsFromFolder
        .mockResolvedValueOnce({ elements: beforeElements })
        .mockResolvedValueOnce({ elements: afterElements, errors: [{ message: 'err', severity: 'Warning' }] })
      const res = await calculatePatch({
        workspace,
        fromDir: 'before',
        toDir: 'after',
        accountName: mockAdapterName,
      })
      expect(res.success).toBeTruthy()
      expect(res.changes).toHaveLength(1)
      expect(res.mergeErrors).toHaveLength(0)
      expect(res.fetchErrors).toHaveLength(1)
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
      mockAdapter.loadElementsFromFolder
        .mockResolvedValueOnce({ elements: beforeElements })
        .mockResolvedValueOnce({ elements: afterElements })
      const res = await calculatePatch({
        workspace,
        fromDir: 'before',
        toDir: 'after',
        accountName: mockAdapterName,
      })
      expect(res.success).toBeTruthy()
      expect(res.fetchErrors).toHaveLength(0)
      expect(res.mergeErrors).toHaveLength(0)
      expect(res.changes).toHaveLength(1)
      const firstChange = (await awu(res.changes).toArray())[0]
      expect(firstChange.pendingChanges).toHaveLength(1)
    })
  })

  describe('when used with an account that does not support loadElementsFromFolder', () => {
    it('Should throw an error', async () => {
      delete (mockAdapter as Adapter).loadElementsFromFolder
      await expect(
        calculatePatch({ workspace, fromDir: 'before', toDir: 'after', accountName: mockAdapterName }),
      ).rejects.toThrow()
    })
  })
})

describe('syncWorkspaceToFolder', () => {
  const mockAdapterName = 'mock'

  let mockAdapter: ReturnType<typeof createMockAdapter>

  beforeEach(() => {
    mockAdapter = createMockAdapter(mockAdapterName)
    adapterCreators[mockAdapterName] = mockAdapter
  })
  afterEach(() => {
    delete adapterCreators[mockAdapterName]
  })
  describe('when the folder has different elements from the workspace', () => {
    let separateInstanceInFolder: InstanceElement
    let separateInstanceInWorkspace: InstanceElement
    let sameInstanceInFolder: InstanceElement
    let sameInstanceInWorkspace: InstanceElement

    let workspace: Workspace
    beforeEach(() => {
      const type = new ObjectType({ elemID: new ElemID(mockAdapterName, 'type') })
      separateInstanceInFolder = new InstanceElement('folderInst', type, { value: 'folder' })
      separateInstanceInWorkspace = new InstanceElement('workspaceInst', type, { value: 'ws' })
      sameInstanceInFolder = new InstanceElement('sameInst', type, { value: 'folder' })
      sameInstanceInWorkspace = new InstanceElement('sameInst', type, { value: 'ws' })

      const workspaceElements = [type, separateInstanceInWorkspace, sameInstanceInWorkspace]
      const folderElements = [type, separateInstanceInFolder, sameInstanceInFolder]

      workspace = mockWorkspace({
        elements: workspaceElements,
        name: 'workspace',
        accounts: [mockAdapterName],
        accountToServiceName: { [mockAdapterName]: mockAdapterName },
      })
      mockAdapter.loadElementsFromFolder.mockResolvedValue({ elements: folderElements })
    })
    describe('when adapter supports all required actions', () => {
      let result: SyncWorkspaceToFolderResult
      beforeEach(async () => {
        result = await syncWorkspaceToFolder({ workspace, accountName: mockAdapterName, baseDir: 'dir' })
      })
      it('should return no errors', () => {
        expect(result.errors).toBeEmpty()
      })
      it('should apply deletion changes for elements that exist in the folder and not the workspace', () => {
        expect(mockAdapter.dumpElementsToFolder).toHaveBeenCalledWith({
          baseDir: 'dir',
          changes: expect.arrayContaining([toChange({ before: separateInstanceInFolder })]),
          elementsSource: expect.anything(),
        })
      })
      it('should apply modification changes for elements that exist in both the workspace and the folder', () => {
        // Note - we currently do not expect the function to filter out changes for elements that are identical
        expect(mockAdapter.dumpElementsToFolder).toHaveBeenCalledWith({
          baseDir: 'dir',
          changes: expect.arrayContaining([toChange({ before: sameInstanceInFolder, after: sameInstanceInWorkspace })]),
          elementsSource: expect.anything(),
        })
      })
      it('should apply addition changes for elements that exist in the workspace and not the folder', () => {
        expect(mockAdapter.dumpElementsToFolder).toHaveBeenCalledWith({
          baseDir: 'dir',
          changes: expect.arrayContaining([toChange({ after: separateInstanceInWorkspace })]),
          elementsSource: expect.anything(),
        })
      })
    })

    describe('when adapter does not support loading from folder', () => {
      let result: Promise<SyncWorkspaceToFolderResult>
      beforeEach(() => {
        delete (mockAdapter as Adapter).loadElementsFromFolder
        result = syncWorkspaceToFolder({ workspace, accountName: mockAdapterName, baseDir: 'dir' })
      })
      it('should throw an error', async () => {
        await expect(result).rejects.toThrow()
      })
    })
    describe('when adapter does not support dumping to folder', () => {
      let result: Promise<SyncWorkspaceToFolderResult>
      beforeEach(() => {
        delete (mockAdapter as Adapter).dumpElementsToFolder
        result = syncWorkspaceToFolder({ workspace, accountName: mockAdapterName, baseDir: 'dir' })
      })
      it('should throw an error', async () => {
        await expect(result).rejects.toThrow()
      })
    })

    describe('when loading elements from folder returns an error', () => {
      let result: SyncWorkspaceToFolderResult
      let errors: SaltoError[]
      beforeEach(async () => {
        errors = [{ severity: 'Error', message: 'something failed' }]
        mockAdapter.loadElementsFromFolder.mockResolvedValue({ elements: [], errors })
        result = await syncWorkspaceToFolder({ workspace, accountName: mockAdapterName, baseDir: 'dir' })
      })
      it('should return the error without trying to update the folder', () => {
        expect(result.errors).toEqual(errors)
        expect(mockAdapter.dumpElementsToFolder).not.toHaveBeenCalled()
      })
    })

    describe('when dumping elements to folder returns an error', () => {
      let result: SyncWorkspaceToFolderResult
      let errors: SaltoError[]
      beforeEach(async () => {
        errors = [{ severity: 'Error', message: 'something failed' }]
        mockAdapter.dumpElementsToFolder.mockResolvedValue({ errors, unappliedChanges: [] })
        result = await syncWorkspaceToFolder({ workspace, accountName: mockAdapterName, baseDir: 'dir' })
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
      result = syncWorkspaceToFolder({ workspace, accountName, baseDir: 'dir' })
    })
    it('should throw an error', async () => {
      await expect(result).rejects.toThrow()
    })
  })
})
