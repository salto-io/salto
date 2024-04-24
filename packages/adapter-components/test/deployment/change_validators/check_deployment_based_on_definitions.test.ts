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
import _ from 'lodash'
import {
  CORE_ANNOTATIONS,
  ElemID,
  InstanceElement,
  ObjectType,
  ReferenceExpression,
  toChange,
} from '@salto-io/adapter-api'
import { createCheckDeploymentBasedOnDefinitionsValidator } from '../../../src/deployment/change_validators/check_deployment_based_on_definitions'
import { DeployApiDefinitions } from '../../../src/definitions/system/deploy'

describe('checkDeploymentBasedOnDefinitionsValidator', () => {
  let type: ObjectType
  let deployDefinitions: DeployApiDefinitions<never, never>
  beforeEach(() => {
    deployDefinitions = {
      instances: {
        customizations: {
          test: {
            requestsByAction: {
              customizations: {
                add: [
                  {
                    request: {
                      endpoint: {
                        path: '/test',
                        method: 'post',
                      },
                    },
                  },
                ],
              },
            },
          },
        },
      },
      dependencies: [],
    }
    type = new ObjectType({ elemID: new ElemID('dum', 'test') })
  })

  it('should not return an error when the changed element is not an instance', async () => {
    const errors = await createCheckDeploymentBasedOnDefinitionsValidator({ deployDefinitions })([
      toChange({ after: type }),
    ])
    expect(errors).toEqual([])
  })

  it('should return an error when type does not support deploy', async () => {
    const instance = new InstanceElement('test2', new ObjectType({ elemID: new ElemID('dum', 'test2') }))
    const errors = await createCheckDeploymentBasedOnDefinitionsValidator({ deployDefinitions })([
      toChange({ after: instance }),
    ])
    expect(errors).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Operation not supported',
        detailedMessage: `Salto does not support "add" of ${instance.elemID.getFullName()}. Please see your business app FAQ at https://help.salto.io/en/articles/6927118-supported-business-applications for a list of supported elements.`,
      },
    ])
  })

  it('should return an error when type does not support specific method', async () => {
    const instance = new InstanceElement('test', type)
    const errors = await createCheckDeploymentBasedOnDefinitionsValidator({ deployDefinitions })([
      toChange({ before: instance }),
    ])
    expect(errors).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Operation not supported',
        detailedMessage: `Salto does not support "remove" of ${instance.elemID.getFullName()}. Please see your business app FAQ at https://help.salto.io/en/articles/6927118-supported-business-applications for a list of supported elements.`,
      },
    ])
  })

  it('should not return an error when operation is supported', async () => {
    const instance = new InstanceElement('test', type)
    const errors = await createCheckDeploymentBasedOnDefinitionsValidator({ deployDefinitions })([
      toChange({ after: instance }),
    ])
    expect(errors).toEqual([])
  })
  it('should not return an error when operation has an early success', async () => {
    const instance = new InstanceElement('test', type)
    _.set(deployDefinitions.instances, 'customizations.test.requestsByAction.customizations.add', [{ request: { earlySuccess: true } }])
    const errors = await createCheckDeploymentBasedOnDefinitionsValidator({ deployDefinitions })([
      toChange({ after: instance }),
    ])
    expect(errors).toEqual([])
  })
  it('should not return an error when operation deployed via parent and parent is supported', async () => {
    const childTypeName = 'testChild'
    const parentInst = new InstanceElement('parent', type)
    const instance = new InstanceElement(
      'test',
      new ObjectType({ elemID: new ElemID('dum', childTypeName) }),
      undefined,
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentInst.elemID, parentInst)] },
    )
    const errors = await createCheckDeploymentBasedOnDefinitionsValidator({
      deployDefinitions,
      typesDeployedViaParent: [childTypeName],
    })([toChange({ after: instance })])
    expect(errors).toEqual([])
  })
  it('should return an error when operation deployed via parent and parent is not supported', async () => {
    const childTypeName = 'testChild'
    const parentInst = new InstanceElement('parent', type)
    const instance = new InstanceElement(
      'test',
      new ObjectType({ elemID: new ElemID('dum', childTypeName) }),
      undefined,
      undefined,
      { [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(parentInst.elemID, parentInst)] },
    )
    const errors = await createCheckDeploymentBasedOnDefinitionsValidator({
      deployDefinitions,
      typesDeployedViaParent: [childTypeName],
    })([toChange({ before: instance })])
    expect(errors).toEqual([
      {
        elemID: instance.elemID,
        severity: 'Error',
        message: 'Operation not supported',
        detailedMessage: `Salto does not support "remove" of ${instance.elemID.getFullName()}. Please see your business app FAQ at https://help.salto.io/en/articles/6927118-supported-business-applications for a list of supported elements.`,
      },
    ])
  })
  it('should not return an error when operation deployed type in in the skipped list', async () => {
    const typeName = 'testChild'
    const instance = new InstanceElement('test', new ObjectType({ elemID: new ElemID('dum', typeName) }))
    const errors = await createCheckDeploymentBasedOnDefinitionsValidator({
      deployDefinitions,
      typesDeployedViaParent: [],
      typesWithNoDeploy: [typeName],
    })([toChange({ after: instance })])
    expect(errors).toEqual([])
  })
})
