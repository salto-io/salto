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
      expect(summarizeDeployChanges(modifyRequestedChanges, appliedChanges)).toEqual({
        [firstEmployeeInstance.elemID.getFullName()]: 'success',
      })
    })
    it('should return the requested change ids as partial-success, when they were partially added', () => {
      const modifyRequestedChanges: Change[] = [{ action: 'add', data: { after: firstEmployeeInstance } }]
      const appliedChanges: Change[] = [{ action: 'add', data: { after: createEmployee({ name: 'FirstEmployee' }) } }]
      expect(summarizeDeployChanges(modifyRequestedChanges, appliedChanges)).toEqual({
        [firstEmployeeInstance.elemID.getFullName()]: 'partial-success',
      })
    })
    it('should return the requested change ids as failure, when applied as modification', () => {
      const modifyRequestedChanges: Change[] = [{ action: 'add', data: { after: firstEmployeeInstance } }]
      const appliedChanges: Change[] = [
        { action: 'modify', data: { before: firstEmployeeInstance, after: firstEmployeeWithNewNickNameAndOffice } },
      ]
      expect(summarizeDeployChanges(modifyRequestedChanges, appliedChanges)).toEqual({
        [firstEmployeeInstance.elemID.getFullName()]: 'failure',
      })
    })
    it('should return the requested change ids as failure, when they wrongfully got removed', () => {
      const modifyRequestedChanges: Change[] = [{ action: 'add', data: { after: firstEmployeeInstance } }]
      const appliedChanges: Change[] = [{ action: 'remove', data: { before: firstEmployeeInstance } }]
      expect(summarizeDeployChanges(modifyRequestedChanges, appliedChanges)).toEqual({
        [firstEmployeeInstance.elemID.getFullName()]: 'failure',
      })
    })
    it('should return the added requested detailed changes ids as failure, when none were applied', () => {
      const modifyRequestedChanges: Change[] = [{ action: 'add', data: { after: firstEmployeeInstance } }]
      expect(summarizeDeployChanges(modifyRequestedChanges, [])).toEqual({
        [firstEmployeeInstance.elemID.getFullName()]: 'failure',
      })
    })
  })
  describe('removal changes', () => {
    it('should return the requested change ids as failure, when they wrongfully got added', () => {
      const modifyRequestedChanges: Change[] = [{ action: 'remove', data: { before: firstEmployeeInstance } }]
      const appliedChanges: Change[] = [{ action: 'add', data: { after: firstEmployeeInstance } }]
      expect(summarizeDeployChanges(modifyRequestedChanges, appliedChanges)).toEqual({
        [firstEmployeeInstance.elemID.getFullName()]: 'failure',
      })
    })
    it('should return the requested change ids as failure, when applied as modification', () => {
      const modifyRequestedChanges: Change[] = [{ action: 'remove', data: { before: firstEmployeeInstance } }]
      const appliedChanges: Change[] = [
        { action: 'modify', data: { before: firstEmployeeInstance, after: firstEmployeeWithNewNickNameAndOffice } },
      ]
      expect(summarizeDeployChanges(modifyRequestedChanges, appliedChanges)).toEqual({
        [firstEmployeeInstance.elemID.getFullName()]: 'partial-success',
      })
    })
    it('should return the requested change ids as success, when removed correctly', () => {
      const modifyRequestedChanges: Change[] = [{ action: 'remove', data: { before: firstEmployeeInstance } }]
      const appliedChanges: Change[] = [{ action: 'remove', data: { before: firstEmployeeInstance } }]
      expect(summarizeDeployChanges(modifyRequestedChanges, appliedChanges)).toEqual({
        [firstEmployeeInstance.elemID.getFullName()]: 'success',
      })
    })
    it('should return the removed requested detailed changes ids as failure, when none were applied', () => {
      const modifyRequestedChanges: Change[] = [{ action: 'remove', data: { before: firstEmployeeInstance } }]
      expect(summarizeDeployChanges(modifyRequestedChanges, [])).toEqual({
        [firstEmployeeInstance.elemID.getFullName()]: 'failure',
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
      expect(summarizeDeployChanges(modifyRequestedChanges, appliedChanges)).toEqual({
        [saltoEmployeeInstanceInstanceID.createNestedID('nicknames', '1').getFullName()]: 'failure',
        [saltoEmployeeInstanceInstanceID.createNestedID('office').getFullName()]: 'failure',
      })
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
      expect(summarizeDeployChanges(modifyRequestedChanges, [])).toEqual({
        [saltoEmployeeInstanceInstanceID.createNestedID('nicknames', '1').getFullName()]: 'failure',
        [saltoEmployeeInstanceInstanceID.createNestedID('office').getFullName()]: 'failure',
      })
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
      expect(summarizeDeployChanges(modifyRequestedChanges, appliedRequestedChanges)).toEqual({
        [saltoEmployeeInstanceInstanceID.createNestedID('nicknames', '1').getFullName()]: 'failure',
        [saltoEmployeeInstanceInstanceID.createNestedID('office').getFullName()]: 'failure',
      })
    })
    it('should return the requested detailed changes ids as success, when modified correctly', () => {
      const modifyRequestedChanges: Change[] = [
        { action: 'modify', data: { before: firstEmployeeInstance, after: firstEmployeeWithNewNickNameAndOffice } },
      ]
      expect(summarizeDeployChanges(modifyRequestedChanges, modifyRequestedChanges)).toEqual({
        [saltoEmployeeInstanceInstanceID.createNestedID('nicknames', '1').getFullName()]: 'success',
        [saltoEmployeeInstanceInstanceID.createNestedID('office').getFullName()]: 'success',
      })
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
      expect(summarizeDeployChanges(modifyRequestedChanges, appliedChanges)).toEqual({
        [saltoEmployeeInstanceInstanceID.createNestedID('nicknames', '1').getFullName()]: 'success',
        [saltoEmployeeInstanceInstanceID.createNestedID('office').getFullName()]: 'partial-success',
      })
    })
    it('should return the requested detailed changes ids as failure, when they wrongfully got removed', () => {
      const modifyRequestedChanges: Change[] = [
        { action: 'modify', data: { before: firstEmployeeInstance, after: firstEmployeeWithNewNickNameAndOffice } },
      ]
      const appliedChanges: Change[] = [{ action: 'remove', data: { before: firstEmployeeInstance } }]
      expect(summarizeDeployChanges(modifyRequestedChanges, appliedChanges)).toEqual({
        [saltoEmployeeInstanceInstanceID.createNestedID('nicknames', '1').getFullName()]: 'failure',
        [saltoEmployeeInstanceInstanceID.createNestedID('office').getFullName()]: 'failure',
      })
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

      expect(summarizeDeployChanges(requestedChanges, [])).toEqual({
        [saltoOffice.elemID.getFullName()]: 'failure',
        [anotherSaltoEmployeeInstance.elemID.getFullName()]: 'failure',
        [saltoEmployeeInstanceInstanceID.createNestedID('hobby').getFullName()]: 'failure',
      })
    })
    it('should return requested change ids as failure when none were applied', () => {
      expect(summarizeDeployChanges(AddRemoveChanges, [])).toEqual({
        [saltoEmployee.elemID.getFullName()]: 'failure',
        [saltoEmployeeInstance.elemID.getFullName()]: 'failure',
      })
    })
    it('should return failures on changes that were not applied', () => {
      expect(summarizeDeployChanges(AddRemoveChanges, [AddRemoveChanges[0]])).toEqual({
        [saltoEmployee.elemID.getFullName()]: 'success',
        [saltoEmployeeInstance.elemID.getFullName()]: 'failure',
      })
    })
    it('should return success summary when all changes were applied', () => {
      expect(summarizeDeployChanges(AddRemoveChanges, AddRemoveChanges)).toEqual({
        [saltoEmployee.elemID.getFullName()]: 'success',
        [saltoEmployeeInstance.elemID.getFullName()]: 'success',
      })
    })
  })
})
