/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { ElemID, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { checkDeploymentValidator } from '../../../src/deployment/change_validators/check_deployment'

describe('checkDeploymentValidator', () => {
  let type: ObjectType
  let config: InstanceElement
  beforeEach(() => {
    type = new ObjectType({ elemID: new ElemID('dum', 'test') })
    config = new InstanceElement(
      'instance',
      new ObjectType({ elemID: new ElemID('dum', 'config') }),
      {
        apiDefinitions: {
          types: {
            test: {
              deployRequests: {
                add: {
                  url: '/test',
                  method: 'post',
                },
              },
            },
          },
        },
      }
    )
  })

  it('should not return an error when the changed element is not an instance', async () => {
    const errors = await checkDeploymentValidator([
      toChange({ after: type }),
    ])
    expect(errors).toEqual([])
  })

  it('should return an error when type does not support deploy', async () => {
    const instance = new InstanceElement(
      'test2',
      new ObjectType({ elemID: new ElemID('dum', 'test2') }),
    )
    const errors = await checkDeploymentValidator(
      [toChange({ after: instance })],
      config,
    )
    expect(errors).toEqual([{
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Operation not supported',
      detailedMessage: `Salto does not support "add" of ${instance.elemID.getFullName()}`,
    }])
  })

  it('should return an error when type does not support specific', async () => {
    const instance = new InstanceElement('test', type)
    const errors = await checkDeploymentValidator(
      [toChange({ before: instance })],
      config,
    )
    expect(errors).toEqual([{
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Operation not supported',
      detailedMessage: `Salto does not support "remove" of ${instance.elemID.getFullName()}`,
    }])
  })

  it('should not return an error when operation is supported', async () => {
    const instance = new InstanceElement('test', type)
    const errors = await checkDeploymentValidator(
      [toChange({ after: instance })],
      config,
    )
    expect(errors).toEqual([])
  })
})
