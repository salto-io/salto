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

import { InstanceElement, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import _ from 'lodash'
import { OBJECT_TYPE_ATTRIBUTE_TYPE, OBJECT_TYPE_LABEL_ATTRIBUTE_TYPE, OBJECT_TYPE_TYPE } from '../../../src/constants'
import { createEmptyType } from '../../utils'
import { deleteLabelAtttributeValidator } from '../../../src/change_validators/assets/label_attribute_removal'
import { JiraConfig, getDefaultConfig } from '../../../src/config/config'

describe('labelAttributeValidator', () => {
  let attributeInstance: InstanceElement
  let config: JiraConfig
  const objectTypeInstance = new InstanceElement('objectTypeInstance', createEmptyType(OBJECT_TYPE_TYPE), {
    id: '1',
    name: 'ObjectType',
  })
  let objectTypeLabelAttributeInstance: InstanceElement
  beforeEach(async () => {
    attributeInstance = new InstanceElement('attribute1', createEmptyType(OBJECT_TYPE_ATTRIBUTE_TYPE), {
      id: 22,
      name: 'Name',
      objectType: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
      description: 'description',
    })
    objectTypeLabelAttributeInstance = new InstanceElement(
      'ObjectTypeLabelAttributeInstance',
      createEmptyType(OBJECT_TYPE_LABEL_ATTRIBUTE_TYPE),
      {
        labelAttribute: new ReferenceExpression(attributeInstance.elemID, attributeInstance),
        objectType: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
      },
    )
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))
    config.fetch.enableJSM = true
    config.fetch.enableJsmExperimental = true
  })
  it('should return error if trying to remove the label attribute', async () => {
    const validator = deleteLabelAtttributeValidator(config)
    const changeErrors = await validator(
      [toChange({ before: attributeInstance })],
      buildElementsSourceFromElements([objectTypeLabelAttributeInstance]),
    )
    expect(changeErrors).toHaveLength(1)
    expect(changeErrors[0]).toEqual({
      elemID: attributeInstance.elemID,
      severity: 'Error',
      message: 'Cannot delete this attribute, as it is the label attribute of its Object Type.',
      detailedMessage: 'Cannot delete this attribute, as it is the label attribute of its objectType.',
    })
  })
  it('should not return error on addition change', async () => {
    const validator = deleteLabelAtttributeValidator(config)
    const changeErrors = await validator(
      [toChange({ after: attributeInstance })],
      buildElementsSourceFromElements([objectTypeLabelAttributeInstance]),
    )
    expect(changeErrors).toHaveLength(0)
  })
  it('should not return error on modification change', async () => {
    const attributeAfter = attributeInstance.clone()
    attributeAfter.value.description = 'new description'
    const validator = deleteLabelAtttributeValidator(config)
    const changeErrors = await validator(
      [toChange({ before: attributeInstance, after: attributeAfter })],
      buildElementsSourceFromElements([objectTypeLabelAttributeInstance]),
    )
    expect(changeErrors).toHaveLength(0)
  })
  it('should not return error on removal change of non label attribute', async () => {
    const nonLbaelAttribute = new InstanceElement('attribute2', createEmptyType(OBJECT_TYPE_ATTRIBUTE_TYPE), {
      id: 222,
      name: 'Name',
      objectType: new ReferenceExpression(objectTypeInstance.elemID, objectTypeInstance),
      description: 'description',
    })
    const validator = deleteLabelAtttributeValidator(config)
    const changeErrors = await validator(
      [toChange({ before: nonLbaelAttribute })],
      buildElementsSourceFromElements([objectTypeLabelAttributeInstance]),
    )
    expect(changeErrors).toHaveLength(0)
  })
  it('should not do anything if enableJsmExperimental is false', async () => {
    config.fetch.enableJsmExperimental = false
    const validator = deleteLabelAtttributeValidator(config)
    const changeErrors = await validator(
      [toChange({ before: attributeInstance })],
      buildElementsSourceFromElements([objectTypeLabelAttributeInstance]),
    )
    expect(changeErrors).toHaveLength(0)
  })
})
