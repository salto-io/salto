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
import { BuiltinTypes, ElemID, Field, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { DEPLOYMENT_ANNOTATIONS } from '../../../src/deployment/annotations'
import { checkDeploymentAnnotationsValidator } from '../../../src/deployment/change_validators/check_deployment_annotations'

describe('checkDeploymentAnnotationsValidator', () => {
  let type: ObjectType
  let instance: InstanceElement
  beforeEach(() => {
    type = new ObjectType({
      elemID: new ElemID('adapter', 'test'),
      fields: {
        updatableField: {
          refType: BuiltinTypes.STRING,
          annotations: { [DEPLOYMENT_ANNOTATIONS.UPDATABLE]: true },
        },
        notUpdatableField: { refType: BuiltinTypes.STRING },
      },
      annotations: {
        [DEPLOYMENT_ANNOTATIONS.UPDATABLE]: true,
        [DEPLOYMENT_ANNOTATIONS.DELETABLE]: true,
      },
    })

    type.fields.inner = new Field(type, 'inner', type, { [DEPLOYMENT_ANNOTATIONS.UPDATABLE]: true })

    instance = new InstanceElement(
      'instance',
      type,
      {
        updatableField: 'value',
        notUpdatableField: 'value',
        inner: {
          updatableField: 'innerValue',
          notUpdatableField: 'innerValue',
        },
      }
    )
  })

  it('should not return an error when the changed element is not an instance', async () => {
    const errors = await checkDeploymentAnnotationsValidator([
      toChange({ after: type }),
    ])
    expect(errors).toEqual([])
  })

  it('should return an error when type does not support operation', async () => {
    const errors = await checkDeploymentAnnotationsValidator([
      toChange({ after: instance }),
    ])
    expect(errors).toEqual([{
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Operation not supported',
      detailedMessage: `Salto does not support "add" of ${instance.elemID.getFullName()}`,
    }])
  })

  it('should return an error when field does not support operation', async () => {
    const afterInstance = instance.clone()
    instance.value.notUpdatableField = 'value2'
    const errors = await checkDeploymentAnnotationsValidator([
      toChange({ before: instance, after: afterInstance }),
    ])
    expect(errors).toEqual([{
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Operation not supported',
      detailedMessage: `Salto does not support "modify" of ${instance.elemID.createNestedID('notUpdatableField').getFullName()}`,
    }])
  })

  it('should return an error when an inner field does not support operation', async () => {
    const afterInstance = instance.clone()
    instance.value.inner.notUpdatableField = 'innerValue2'
    const errors = await checkDeploymentAnnotationsValidator([
      toChange({ before: instance, after: afterInstance }),
    ])
    expect(errors).toEqual([{
      elemID: instance.elemID,
      severity: 'Error',
      message: 'Operation not supported',
      detailedMessage: `Salto does not support "modify" of ${instance.elemID.createNestedID('inner', 'notUpdatableField').getFullName()}`,
    }])
  })

  it('should not return an error when operation is supported', async () => {
    const afterInstance = instance.clone()
    afterInstance.value.updatableField = 'value2'
    afterInstance.value.inner.updatableField = 'innerValue2'

    const errors = await checkDeploymentAnnotationsValidator([
      toChange({ before: instance, after: afterInstance }),
      toChange({ before: afterInstance }),
    ])
    expect(errors).toEqual([])
  })
})
