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
import {
  AdapterOperations,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { createInstance, deployChangesForE2e, deployCleanup, getTestSuffix, TEST_PREFIX } from '../src/e2e_utils'
import { APIDefinitionsOptions } from '../src/definitions'
import { FetchApiDefinitions } from '../src/definitions/system/fetch'

const mockApplyDetailedChanges = jest.fn()
jest.mock('@salto-io/adapter-utils', () => ({
  ...jest.requireActual<{}>('@salto-io/adapter-utils'),
  applyDetailedChanges: jest.fn((...args) => mockApplyDetailedChanges(...args)),
  detailedCompare: jest.fn().mockReturnValue([]),
}))

describe('E2E Tests Utility Functions', () => {
  const mockDeploy = jest.fn()
  const mockAdapter: AdapterOperations = {
    deploy: mockDeploy,
    fetch: jest.fn(),
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('deployChangesForE2e', () => {
    it('should deploy changes and apply detailed changes', async () => {
      const afterInstance = new InstanceElement('test', new ObjectType({ elemID: new ElemID('adapter', 'test') }))
      const changes = [toChange({ after: afterInstance })]
      const adapterAttr = { adapter: mockAdapter }
      const mockDeployResult = {
        errors: [],
        appliedChanges: changes,
      }
      mockDeploy.mockResolvedValue(mockDeployResult)

      const results = await deployChangesForE2e(adapterAttr, changes)

      expect(results).toHaveLength(1)
      expect(results[0]).toEqual(mockDeployResult)
      expect(mockAdapter.deploy).toHaveBeenCalledTimes(1)
      expect(mockApplyDetailedChanges).toHaveBeenCalledWith(afterInstance, [])
    })
  })

  describe('createInstance', () => {
    const typeName = 'TestType'
    const testSuffix = getTestSuffix()
    const types: ObjectType[] = [new ObjectType({ elemID: new ElemID('adapter', typeName) })]
    const parent = new InstanceElement('parent', types[0])
    const anotherInstance = new InstanceElement('ref', types[0])
    const anotherRef = new ReferenceExpression(anotherInstance.elemID, anotherInstance)
    const values = {
      name: `${TEST_PREFIX}${typeName}${testSuffix}`,
      irrelevantField: 'hop hey',
      refField: anotherRef,
    }
    const fetchDefinitions: FetchApiDefinitions<APIDefinitionsOptions> = {
      instances: {
        customizations: {
          [typeName]: {
            element: {
              topLevel: {
                isTopLevel: true,
                elemID: {
                  parts: [{ fieldName: 'refField', isReference: true }, { fieldName: 'name' }],
                  extendsParent: true,
                },
              },
            },
          },
        },
      },
    }

    it('should create an instance with the correct values and elementId', () => {
      const instance = createInstance({
        typeName,
        types,
        fetchDefinitions,
        values,
        parent,
      })

      expect(instance.value.name).toBe(`${TEST_PREFIX}${typeName}${testSuffix}`)
      expect(instance.value.refField).toEqual(anotherRef)
      expect(instance.elemID.getFullName()).toBe(
        `adapter.TestType.instance.parent__ref_${TEST_PREFIX}${typeName}${testSuffix}`,
      )
    })

    it('should throw error if type elemID definitions not found', () => {
      expect(() =>
        createInstance({
          typeName,
          types,
          fetchDefinitions: { instances: {} },
          values,
        }),
      ).toThrow(`Could not find type elemID definitions for type ${typeName}`)
    })

    it('should throw error if type not found', () => {
      expect(() =>
        createInstance({
          typeName: 'NonExistentType',
          types,
          fetchDefinitions,
          values,
        }),
      ).toThrow('Could not find type elemID definitions for type NonExistentType')
    })
  })

  describe('deployCleanup', () => {
    const typeName = 'TestType'
    it('should perform cleanup for instances created for test', async () => {
      const instances: InstanceElement[] = [
        new InstanceElement('test', new ObjectType({ elemID: new ElemID('adapter', typeName) }), {
          uniqueField: `${TEST_PREFIX}${typeName}1234`,
        }),
        new InstanceElement('test2', new ObjectType({ elemID: new ElemID('adapter', typeName) }), {
          uniqueField: 'blabla',
        }),
      ]
      const uniqueFieldsPerType = { [typeName]: ['uniqueField'] }
      const adapterAttr = { adapter: mockAdapter }

      mockDeploy.mockResolvedValue({
        errors: [],
        appliedChanges: [{}],
      })

      await deployCleanup(adapterAttr, instances, uniqueFieldsPerType)

      expect(mockAdapter.deploy).toHaveBeenCalledWith(
        expect.objectContaining({
          changeGroup: expect.objectContaining({ changes: [toChange({ before: instances[0] })] }),
        }),
      )
    })
  })
})
