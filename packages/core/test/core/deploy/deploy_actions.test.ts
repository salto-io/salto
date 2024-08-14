/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import {
  AdapterOperations,
  Change,
  DependencyChanger,
  Element,
  ElemID,
  InstanceElement,
  isInstanceChange,
  isObjectTypeChange,
  ObjectType,
} from '@salto-io/adapter-api'
import { deployActions } from '../../../src/core/deploy'
import { Plan, getPlan } from '../../../src/core/plan'
import { DeployError } from '../../../src/types'

const ADAPTER_NAME = 'adapter'

const createDeployPlanFromElements = async (elements: Element[]): Promise<Plan> => {
  const dependencyChanger: DependencyChanger = async changes => {
    const typeChangeId = Array.from(changes.entries())
      .filter(([, change]) => isObjectTypeChange(change))
      .map(([changeId]) => changeId)[0]
    return Array.from(changes.entries())
      .filter(([, change]) => isInstanceChange(change))
      .map(([changeId]) => ({
        action: 'add',
        dependency: {
          source: changeId,
          target: typeChangeId,
        },
      }))
  }
  return getPlan({
    before: buildElementsSourceFromElements([]),
    after: buildElementsSourceFromElements(elements),
    customGroupIdFunctions: {
      [ADAPTER_NAME]: async changes => ({
        changeGroupIdMap: new Map(Array.from(changes.keys()).map(changeId => [changeId, changeId as string])),
      }),
    },
    dependencyChangers: [dependencyChanger],
  })
}

describe('deployActions', () => {
  let deployResult: {
    errors: DeployError[]
    appliedChanges: Change[]
  }
  describe('Dependent group behavior on errors', () => {
    const objectType = new ObjectType({
      elemID: new ElemID(ADAPTER_NAME, 'SomeType'),
    })
    describe('When a group has an error with `info` severity', () => {
      beforeEach(async () => {
        const instance = new InstanceElement('Instance1', objectType)
        const deployPlan: Plan = await createDeployPlanFromElements([objectType, instance])
        const mockAdapterOperations: AdapterOperations = {
          fetch: jest.fn().mockResolvedValue({}),
          deploy: jest.fn().mockImplementation(async deployParams => ({
            errors: [
              {
                message: 'Test message',
                severity: 'Info' as const,
              },
            ],
            appliedChanges: deployParams.changeGroup.changes,
          })),
        }
        deployResult = await deployActions(
          deployPlan,
          {
            [ADAPTER_NAME]: mockAdapterOperations,
          },
          () => {},
          async () => {},
          false,
        )
      })
      it('Should produce the correct errors', () => {
        expect(deployResult.errors).toHaveLength(2)
        expect(deployResult.errors).toSatisfyAll(error => error.severity === 'Info')
      })
      it('Should still deploy the dependant group', () => {
        expect(deployResult.appliedChanges).toHaveLength(2)
      })
    })
    describe('When a group has an error with `error` severity', () => {
      beforeEach(async () => {
        const instance1 = new InstanceElement('Instance1', objectType)
        const instance2 = new InstanceElement('Instance2', objectType)
        const deployPlan: Plan = await createDeployPlanFromElements([objectType, instance1, instance2])
        const mockAdapterOperations: AdapterOperations = {
          fetch: jest.fn().mockResolvedValue({}),
          deploy: jest.fn().mockImplementation(async deployParams => {
            if (deployParams.changeGroup.groupID.includes('instance')) {
              return {
                errors: [],
                appliedChanges: deployParams.changeGroup.changes,
              }
            }
            return {
              errors: [
                {
                  message: 'Test message',
                  severity: 'Error' as const,
                },
              ],
              appliedChanges: [],
            }
          }),
        }
        deployResult = await deployActions(
          deployPlan,
          {
            [ADAPTER_NAME]: mockAdapterOperations,
          },
          () => {},
          async () => {},
          false,
        )
      })
      it('Should produce the correct error', () => {
        expect(deployResult.errors).toHaveLength(3)
        expect(deployResult.errors).toSatisfyAll(error => error.severity === 'Error')
        expect(deployResult.errors).toEqual([
          expect.objectContaining({
            message: 'Test message',
          }),
          expect.objectContaining({
            message: 'Element was not deployed, as it depends on adapter.SomeType/add which failed to deploy',
          }),
          expect.objectContaining({
            message: 'Element was not deployed, as it depends on adapter.SomeType/add which failed to deploy',
          }),
        ])
      })
      it('Should not deploy dependant groups', () => {
        expect(deployResult.appliedChanges).toBeEmpty()
      })
    })
  })
})
