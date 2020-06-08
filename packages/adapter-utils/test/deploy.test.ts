/*
*                      Copyright 2020 Salto Labs Ltd.
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
import { ObjectType, ElemID, InstanceElement, DeployResult, getChangeElement } from '@salto-io/adapter-api'
import { deployInstance, ChangeOperations } from '../src/deploy'
import { mockFunction, toChangeGroup } from './common'

type MockInterface<T extends { [key: string]: (...args: never[]) => unknown }> = {
  [k in keyof T]: jest.Mock<ReturnType<T[k]>, Parameters<T[k]>>
}

describe('deployInstance', () => {
  const testType = new ObjectType({ elemID: new ElemID('test', 'type') })
  const testInst = new InstanceElement('test', testType, { val: 'some value' })

  let result: DeployResult
  let testOperations: MockInterface<ChangeOperations>
  beforeEach(() => {
    testOperations = {
      add: mockFunction<ChangeOperations['add']>().mockImplementation(
        elem => Promise.resolve(elem)
      ),
      remove: mockFunction<ChangeOperations['remove']>().mockResolvedValue(),
      update: mockFunction<ChangeOperations['update']>().mockImplementation(
        (_before, after) => Promise.resolve(after)
      ),
    }
  })

  describe('with non instance change', () => {
    beforeEach(async () => {
      result = await deployInstance(testOperations, toChangeGroup({ after: testType }))
    })
    it('should return error', async () => {
      expect(result.errors).toHaveLength(1)
      expect(result.errors[0].message).toMatch('Only instance changes supported')
    })
  })

  describe('with add change', () => {
    describe('when the add function succeeds', () => {
      let updatedInst: InstanceElement
      beforeEach(async () => {
        updatedInst = testInst.clone()
        updatedInst.value.bla = 1
        testOperations.add.mockResolvedValueOnce(updatedInst)

        result = await deployInstance(testOperations, toChangeGroup({ after: testInst }))
      })
      it('should call add function', () => {
        expect(testOperations.add).toHaveBeenCalledWith(testInst)
      })
      it('should not return errors', () => {
        expect(result.errors).toHaveLength(0)
      })
      it('should return the applied change with the return value from the function', () => {
        expect(result.appliedChanges).toHaveLength(1)
        expect(result.appliedChanges[0].action).toEqual('add')
        expect(getChangeElement(result.appliedChanges[0])).toBe(updatedInst)
      })
    })

    describe('when the add function fails', () => {
      let error: Error
      beforeEach(async () => {
        error = new Error('Operation failed')
        testOperations.add.mockRejectedValueOnce(error)

        result = await deployInstance(testOperations, toChangeGroup({ after: testInst }))
      })
      it('should return the error', () => {
        expect(result.errors).toHaveLength(1)
        expect(result.errors[0]).toEqual(error)
      })
      it('should not return applied changes', () => {
        expect(result.appliedChanges).toHaveLength(0)
      })
    })
  })

  describe('with remove change', () => {
    beforeEach(async () => {
      result = await deployInstance(testOperations, toChangeGroup({ before: testInst }))
    })
    it('should call remove function', () => {
      expect(testOperations.remove).toHaveBeenCalledWith(testInst)
    })
    it('should not return errors', () => {
      expect(result.errors).toHaveLength(0)
    })
    it('should return the applied remove change', () => {
      expect(result.appliedChanges).toHaveLength(1)
      expect(result.appliedChanges[0].action).toEqual('remove')
      expect(getChangeElement(result.appliedChanges[0])).toBe(testInst)
    })
  })

  describe('with update change', () => {
    let after: InstanceElement
    beforeEach(async () => {
      after = testInst.clone()
      after.value.bla = 1

      result = await deployInstance(testOperations, toChangeGroup({ before: testInst, after }))
    })
    it('should call update function', () => {
      expect(testOperations.update).toHaveBeenCalledWith(testInst, after)
    })
    it('should not return errors', () => {
      expect(result.errors).toHaveLength(0)
    })
    it('should return the applied change with the return value from the function', () => {
      expect(result.appliedChanges).toHaveLength(1)
      expect(result.appliedChanges[0].action).toEqual('modify')
      expect(getChangeElement(result.appliedChanges[0])).toBe(after)
    })
  })
})
