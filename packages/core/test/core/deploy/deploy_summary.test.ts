/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Change, ElemID, InstanceElement, Values } from '@salto-io/adapter-api'
import { summarizeDeployChanges } from '../../../src/core/deploy/deploy_summary'
import * as mockElements from '../../common/elements'

describe('summarizeDeployChanges', () => {
  const [, , saltoOffice, saltoEmployee, saltoEmployeeInstance, , , , anotherSaltoEmployeeInstance] =
    mockElements.getAllElements()
  const AddRemoveChanges: Change[] = [
    { action: 'add', data: { after: saltoEmployee.clone() } },
    { action: 'remove', data: { before: saltoEmployeeInstance.clone() } },
  ]
  const createEmployee = (value: Values): InstanceElement => new InstanceElement('instance', saltoEmployee, value)
  const firstEmployeeInstance = createEmployee({ name: 'FirstEmployee', nicknames: ['you', 'hi'] })
  const firstEmployeeWithNewNickNameAndOffice = createEmployee({
    name: 'FirstEmployee',
    nicknames: ['you', 'hello'],
    office: { label: 'bla', name: 'foo', seats: { c1: 'n1', c2: 'n2' } },
  })

  const saltoEmployeeInstanceInstanceID = new ElemID('salto', 'employee', 'instance', 'instance')

  describe('addition changes', () => {
    it('should return the requested change ids as success, when added correctly', () => {
      const modifyRequestedChanges: Change[] = [{ action: 'add', data: { after: firstEmployeeInstance } }]
      const appliedChanges: Change[] = [{ action: 'add', data: { after: firstEmployeeInstance } }]
      const deploymentSummary = summarizeDeployChanges(modifyRequestedChanges, appliedChanges)
      expect(deploymentSummary.elemIdToResult).toEqual({
        [firstEmployeeInstance.elemID.getFullName()]: 'success',
      })
      expect(deploymentSummary.resultToElemId).toEqual({
        success: [firstEmployeeInstance.elemID.getFullName()],
        failure: [],
        'partial-success': [],
      })
    })
    it('should return the requested change ids as partial-success, when they were partially added', () => {
      const modifyRequestedChanges: Change[] = [{ action: 'add', data: { after: firstEmployeeInstance } }]
      const appliedChanges: Change[] = [{ action: 'add', data: { after: createEmployee({ name: 'FirstEmployee' }) } }]
      const deploymentSummary = summarizeDeployChanges(modifyRequestedChanges, appliedChanges)
      expect(deploymentSummary.elemIdToResult).toEqual({
        [firstEmployeeInstance.elemID.getFullName()]: 'partial-success',
      })
      expect(deploymentSummary.resultToElemId).toEqual({
        success: [],
        failure: [],
        'partial-success': [firstEmployeeInstance.elemID.getFullName()],
      })
    })
    it('should return the requested change ids as failure, when applied as modification', () => {
      const modifyRequestedChanges: Change[] = [{ action: 'add', data: { after: firstEmployeeInstance } }]
      const appliedChanges: Change[] = [
        { action: 'modify', data: { before: firstEmployeeInstance, after: firstEmployeeWithNewNickNameAndOffice } },
      ]
      const deploymentSummary = summarizeDeployChanges(modifyRequestedChanges, appliedChanges)
      expect(deploymentSummary.elemIdToResult).toEqual({
        [firstEmployeeInstance.elemID.getFullName()]: 'failure',
      })
      expect(deploymentSummary.resultToElemId).toEqual({
        success: [],
        failure: [firstEmployeeInstance.elemID.getFullName()],
        'partial-success': [],
      })
    })
    it('should return the requested change ids as failure, when they wrongfully got removed', () => {
      const modifyRequestedChanges: Change[] = [{ action: 'add', data: { after: firstEmployeeInstance } }]
      const appliedChanges: Change[] = [{ action: 'remove', data: { before: firstEmployeeInstance } }]
      const deploymentSummary = summarizeDeployChanges(modifyRequestedChanges, appliedChanges)
      expect(deploymentSummary.elemIdToResult).toEqual({
        [firstEmployeeInstance.elemID.getFullName()]: 'failure',
      })
      expect(deploymentSummary.resultToElemId).toEqual({
        success: [],
        failure: [firstEmployeeInstance.elemID.getFullName()],
        'partial-success': [],
      })
    })
    it('should return the added requested detailed changes ids as failure, when none were applied', () => {
      const modifyRequestedChanges: Change[] = [{ action: 'add', data: { after: firstEmployeeInstance } }]
      const deploymentSummary = summarizeDeployChanges(modifyRequestedChanges, [])
      expect(deploymentSummary.elemIdToResult).toEqual({
        [firstEmployeeInstance.elemID.getFullName()]: 'failure',
      })
      expect(deploymentSummary.resultToElemId).toEqual({
        success: [],
        failure: [firstEmployeeInstance.elemID.getFullName()],
        'partial-success': [],
      })
    })
  })
  describe('removal changes', () => {
    it('should return the requested change ids as failure, when they wrongfully got added', () => {
      const modifyRequestedChanges: Change[] = [{ action: 'remove', data: { before: firstEmployeeInstance } }]
      const appliedChanges: Change[] = [{ action: 'add', data: { after: firstEmployeeInstance } }]
      const deploymentSummary = summarizeDeployChanges(modifyRequestedChanges, appliedChanges)
      expect(deploymentSummary.elemIdToResult).toEqual({
        [firstEmployeeInstance.elemID.getFullName()]: 'failure',
      })
      expect(deploymentSummary.resultToElemId).toEqual({
        success: [],
        failure: [firstEmployeeInstance.elemID.getFullName()],
        'partial-success': [],
      })
    })
    it('should return the requested change ids as failure, when applied as modification', () => {
      const modifyRequestedChanges: Change[] = [{ action: 'remove', data: { before: firstEmployeeInstance } }]
      const appliedChanges: Change[] = [
        { action: 'modify', data: { before: firstEmployeeInstance, after: firstEmployeeWithNewNickNameAndOffice } },
      ]
      const deploymentSummary = summarizeDeployChanges(modifyRequestedChanges, appliedChanges)
      expect(deploymentSummary.elemIdToResult).toEqual({
        [firstEmployeeInstance.elemID.getFullName()]: 'partial-success',
      })
      expect(deploymentSummary.resultToElemId).toEqual({
        success: [],
        failure: [],
        'partial-success': [firstEmployeeInstance.elemID.getFullName()],
      })
    })
    it('should return the requested change ids as success, when removed correctly', () => {
      const modifyRequestedChanges: Change[] = [{ action: 'remove', data: { before: firstEmployeeInstance } }]
      const appliedChanges: Change[] = [{ action: 'remove', data: { before: firstEmployeeInstance } }]
      const deploymentSummary = summarizeDeployChanges(modifyRequestedChanges, appliedChanges)
      expect(deploymentSummary.elemIdToResult).toEqual({
        [firstEmployeeInstance.elemID.getFullName()]: 'success',
      })
      expect(deploymentSummary.resultToElemId).toEqual({
        success: [firstEmployeeInstance.elemID.getFullName()],
        failure: [],
        'partial-success': [],
      })
    })
    it('should return the removed requested detailed changes ids as failure, when none were applied', () => {
      const modifyRequestedChanges: Change[] = [{ action: 'remove', data: { before: firstEmployeeInstance } }]
      const deploymentSummary = summarizeDeployChanges(modifyRequestedChanges, [])
      expect(deploymentSummary.elemIdToResult).toEqual({
        [firstEmployeeInstance.elemID.getFullName()]: 'failure',
      })
      expect(deploymentSummary.resultToElemId).toEqual({
        success: [],
        failure: [firstEmployeeInstance.elemID.getFullName()],
        'partial-success': [],
      })
    })
  })
  describe('modify changes', () => {
    const firstEmployeeWithNewNickNameAndOfficePartiallyCreated = createEmployee({
      name: 'FirstEmployee',
      nicknames: ['you', 'hello'],
      office: { label: 'bla' },
    })
    it('should return the requested change ids as failure, when they wrongfully got added', () => {
      const modifyRequestedChanges: Change[] = [
        { action: 'modify', data: { before: firstEmployeeInstance, after: firstEmployeeWithNewNickNameAndOffice } },
      ]
      const appliedChanges: Change[] = [{ action: 'add', data: { after: firstEmployeeWithNewNickNameAndOffice } }]
      const deploymentSummary = summarizeDeployChanges(modifyRequestedChanges, appliedChanges)
      expect(deploymentSummary.elemIdToResult).toEqual({
        [saltoEmployeeInstanceInstanceID.createNestedID('nicknames', '1').getFullName()]: 'failure',
        [saltoEmployeeInstanceInstanceID.createNestedID('office').getFullName()]: 'failure',
      })
      expect(deploymentSummary.resultToElemId.failure).toIncludeSameMembers([
        saltoEmployeeInstanceInstanceID.createNestedID('nicknames', '1').getFullName(),
        saltoEmployeeInstanceInstanceID.createNestedID('office').getFullName(),
      ])
      expect(deploymentSummary.resultToElemId['partial-success']).toEqual([])
      expect(deploymentSummary.resultToElemId.success).toEqual([])
    })
    it('should return the requested modified detailed changes ids as failure, when none were applied', () => {
      const modifyRequestedChanges: Change[] = [
        {
          action: 'modify',
          data: {
            before: firstEmployeeInstance,
            after: firstEmployeeWithNewNickNameAndOffice,
          },
        },
      ]
      const deploymentSummary = summarizeDeployChanges(modifyRequestedChanges, [])
      expect(deploymentSummary.elemIdToResult).toEqual({
        [saltoEmployeeInstanceInstanceID.createNestedID('nicknames', '1').getFullName()]: 'failure',
        [saltoEmployeeInstanceInstanceID.createNestedID('office').getFullName()]: 'failure',
      })
      expect(deploymentSummary.resultToElemId.failure).toIncludeSameMembers([
        saltoEmployeeInstanceInstanceID.createNestedID('nicknames', '1').getFullName(),
        saltoEmployeeInstanceInstanceID.createNestedID('office').getFullName(),
      ])
      expect(deploymentSummary.resultToElemId['partial-success']).toEqual([])
      expect(deploymentSummary.resultToElemId.success).toEqual([])
    })
    it('should return the requested modified detailed changes ids as failure, when they were not applied', () => {
      const modifyRequestedChanges: Change[] = [
        {
          action: 'modify',
          data: {
            before: firstEmployeeInstance,
            after: firstEmployeeWithNewNickNameAndOffice,
          },
        },
      ]
      const appliedRequestedChanges: Change[] = [
        {
          action: 'modify',
          data: {
            before: firstEmployeeInstance,
            after: firstEmployeeInstance,
          },
        },
      ]
      const deploymentSummary = summarizeDeployChanges(modifyRequestedChanges, appliedRequestedChanges)
      expect(deploymentSummary.elemIdToResult).toEqual({
        [saltoEmployeeInstanceInstanceID.createNestedID('nicknames', '1').getFullName()]: 'failure',
        [saltoEmployeeInstanceInstanceID.createNestedID('office').getFullName()]: 'failure',
      })
      expect(deploymentSummary.resultToElemId.failure).toIncludeSameMembers([
        saltoEmployeeInstanceInstanceID.createNestedID('nicknames', '1').getFullName(),
        saltoEmployeeInstanceInstanceID.createNestedID('office').getFullName(),
      ])
      expect(deploymentSummary.resultToElemId['partial-success']).toEqual([])
      expect(deploymentSummary.resultToElemId.success).toEqual([])
    })
    it('should return the requested detailed changes ids as success, when modified correctly', () => {
      const modifyRequestedChanges: Change[] = [
        { action: 'modify', data: { before: firstEmployeeInstance, after: firstEmployeeWithNewNickNameAndOffice } },
      ]
      const deploymentSummary = summarizeDeployChanges(modifyRequestedChanges, modifyRequestedChanges)
      expect(deploymentSummary.elemIdToResult).toEqual({
        [saltoEmployeeInstanceInstanceID.createNestedID('nicknames', '1').getFullName()]: 'success',
        [saltoEmployeeInstanceInstanceID.createNestedID('office').getFullName()]: 'success',
      })
      expect(deploymentSummary.resultToElemId.success).toIncludeSameMembers([
        saltoEmployeeInstanceInstanceID.createNestedID('nicknames', '1').getFullName(),
        saltoEmployeeInstanceInstanceID.createNestedID('office').getFullName(),
      ])
      expect(deploymentSummary.resultToElemId.failure).toEqual([])
      expect(deploymentSummary.resultToElemId['partial-success']).toEqual([])
    })
    it('should return the requested detailed changes ids as partial success when they were partially created', () => {
      const modifyRequestedChanges: Change[] = [
        { action: 'modify', data: { before: firstEmployeeInstance, after: firstEmployeeWithNewNickNameAndOffice } },
      ]
      const appliedChanges: Change[] = [
        {
          action: 'modify',
          data: { before: firstEmployeeInstance, after: firstEmployeeWithNewNickNameAndOfficePartiallyCreated },
        },
      ]
      const deploymentSummary = summarizeDeployChanges(modifyRequestedChanges, appliedChanges)
      expect(deploymentSummary.elemIdToResult).toEqual({
        [saltoEmployeeInstanceInstanceID.createNestedID('nicknames', '1').getFullName()]: 'success',
        [saltoEmployeeInstanceInstanceID.createNestedID('office').getFullName()]: 'partial-success',
      })
      expect(deploymentSummary.resultToElemId).toEqual({
        success: [saltoEmployeeInstanceInstanceID.createNestedID('nicknames', '1').getFullName()],
        failure: [],
        'partial-success': [saltoEmployeeInstanceInstanceID.createNestedID('office').getFullName()],
      })
    })
    it('should return the requested detailed changes ids as failure, when they wrongfully got removed', () => {
      const modifyRequestedChanges: Change[] = [
        { action: 'modify', data: { before: firstEmployeeInstance, after: firstEmployeeWithNewNickNameAndOffice } },
      ]
      const appliedChanges: Change[] = [{ action: 'remove', data: { before: firstEmployeeInstance } }]
      const deploymentSummary = summarizeDeployChanges(modifyRequestedChanges, appliedChanges)
      expect(deploymentSummary.elemIdToResult).toEqual({
        [saltoEmployeeInstanceInstanceID.createNestedID('nicknames', '1').getFullName()]: 'failure',
        [saltoEmployeeInstanceInstanceID.createNestedID('office').getFullName()]: 'failure',
      })
      expect(deploymentSummary.resultToElemId.failure).toIncludeSameMembers([
        saltoEmployeeInstanceInstanceID.createNestedID('nicknames', '1').getFullName(),
        saltoEmployeeInstanceInstanceID.createNestedID('office').getFullName(),
      ])
      expect(deploymentSummary.resultToElemId['partial-success']).toEqual([])
      expect(deploymentSummary.resultToElemId.success).toEqual([])
    })
  })
  describe('changes with different actions', () => {
    it('should return all changes as failure then they were not applied', () => {
      const requestedChanges: Change[] = [
        { action: 'remove', data: { before: anotherSaltoEmployeeInstance } },
        { action: 'add', data: { after: saltoOffice } },
        {
          action: 'modify',
          data: {
            before: createEmployee({ hobby: 'sports' }),
            after: createEmployee({ hobby: 'basketball' }),
          },
        },
      ]
      const deploymentSummary = summarizeDeployChanges(requestedChanges, [])
      expect(deploymentSummary.elemIdToResult).toEqual({
        [saltoOffice.elemID.getFullName()]: 'failure',
        [anotherSaltoEmployeeInstance.elemID.getFullName()]: 'failure',
        [saltoEmployeeInstanceInstanceID.createNestedID('hobby').getFullName()]: 'failure',
      })
      expect(deploymentSummary.resultToElemId['failure']).toIncludeSameMembers([
        saltoOffice.elemID.getFullName(),
        anotherSaltoEmployeeInstance.elemID.getFullName(),
        saltoEmployeeInstanceInstanceID.createNestedID('hobby').getFullName(),
      ])

      expect(deploymentSummary.resultToElemId['success']).toEqual([])
      expect(deploymentSummary.resultToElemId['partial-success']).toEqual([])
    })
    it('should return requested change ids as failure when none were applied', () => {
      const deploymentSummary = summarizeDeployChanges(AddRemoveChanges, [])
      expect(deploymentSummary.elemIdToResult).toEqual({
        [saltoEmployee.elemID.getFullName()]: 'failure',
        [saltoEmployeeInstance.elemID.getFullName()]: 'failure',
      })
      expect(deploymentSummary.resultToElemId.failure).toIncludeSameMembers([
        saltoEmployee.elemID.getFullName(),
        saltoEmployeeInstance.elemID.getFullName(),
      ])
      expect(deploymentSummary.resultToElemId['partial-success']).toEqual([])
      expect(deploymentSummary.resultToElemId.success).toEqual([])
    })
    it('should return failures on changes that were not applied', () => {
      const deploymentSummary = summarizeDeployChanges(AddRemoveChanges, [AddRemoveChanges[0]])
      expect(deploymentSummary.elemIdToResult).toEqual({
        [saltoEmployee.elemID.getFullName()]: 'success',
        [saltoEmployeeInstance.elemID.getFullName()]: 'failure',
      })
      expect(deploymentSummary.resultToElemId).toEqual({
        success: [saltoEmployee.elemID.getFullName()],
        failure: [saltoEmployeeInstance.elemID.getFullName()],
        'partial-success': [],
      })
    })
    it('should return success summary when all changes were applied', () => {
      const deploymentSummary = summarizeDeployChanges(AddRemoveChanges, AddRemoveChanges)
      expect(deploymentSummary.elemIdToResult).toEqual({
        [saltoEmployee.elemID.getFullName()]: 'success',
        [saltoEmployeeInstance.elemID.getFullName()]: 'success',
      })
      expect(deploymentSummary.resultToElemId.success).toIncludeSameMembers([
        saltoEmployee.elemID.getFullName(),
        saltoEmployeeInstance.elemID.getFullName(),
      ])
      expect(deploymentSummary.resultToElemId.failure).toEqual([])
      expect(deploymentSummary.resultToElemId['partial-success']).toEqual([])
    })
  })
})
