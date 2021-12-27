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
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, Field, InstanceElement, ObjectType, toChange } from '@salto-io/adapter-api'
import { checkDeploymentAnnotationsValidator } from '../../../../src/core/plan/change_validators/check_deployment_annotations'

describe('checkDeploymentAnnotationsValidator', () => {
  let type: ObjectType
  let instance: InstanceElement
  beforeEach(() => {
    type = new ObjectType({
      elemID: new ElemID('adapter', 'test'),
      fields: {
        updatableField: {
          refType: BuiltinTypes.STRING,
          annotations: { [CORE_ANNOTATIONS.CREATABLE]: false },
        },
        notUpdatableField: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [CORE_ANNOTATIONS.CREATABLE]: false,
            [CORE_ANNOTATIONS.UPDATABLE]: false,
          },
        },
      },
      annotations: {
        [CORE_ANNOTATIONS.CREATABLE]: false,
      },
    })

    type.fields.inner = new Field(type, 'inner', type, { [CORE_ANNOTATIONS.UPDATABLE]: true })

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
      message: `The change of ${type.elemID.getFullName()} is not supported and will be omitted from deploy`,
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
      severity: 'Warning',
      message: `The change of ${type.fields.notUpdatableField.elemID.getFullName()} is not supported and will be omitted from deploy`,
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
      severity: 'Warning',
      message: `The change of ${type.fields.notUpdatableField.elemID.getFullName()} is not supported and will be omitted from deploy`,
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
