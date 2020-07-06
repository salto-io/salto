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
import {
  BuiltinTypes, ElemID, InstanceElement, ObjectType, ReferenceExpression,
} from '@salto-io/adapter-api'
import { validateDependsOnInvalidElement } from '../src/change_validator'
import { customTypes, fileCabinetTypes } from '../src/types'
import { ENTITY_CUSTOM_FIELD, FILE, PATH, SCRIPT_ID } from '../src/constants'
import { toChange } from './utils'

describe('Change Validator', () => {
  const customFieldInstance = new InstanceElement('elementName',
    customTypes[ENTITY_CUSTOM_FIELD], {
      label: 'elementName',
      [SCRIPT_ID]: 'custentity_my_script_id',
    })

  const fileInstance = new InstanceElement('fileInstance', fileCabinetTypes[FILE], {
    [PATH]: 'Templates/E-mail Templates/Inner EmailTemplates Folder/content.html',
  })

  const dependsOn1Instance = new InstanceElement('dependsOn1Instance', customTypes[ENTITY_CUSTOM_FIELD], {
    [SCRIPT_ID]: 'custentity_depends_on_1_instance',
    label: new ReferenceExpression(fileInstance.elemID.createNestedID(PATH),
      fileInstance.value[PATH], fileInstance),
  })

  const anotherAdapterInstance = new InstanceElement(
    'anotherAdapterInstance',
    new ObjectType({ elemID: new ElemID('another', 'type'),
      fields: {
        id: { type: BuiltinTypes.SERVICE_ID },
      } }),
    { id: 'serviceIdValue' },
  )

  const instanceWithManyRefs = new InstanceElement('dependsOn2Instances', customTypes[ENTITY_CUSTOM_FIELD], {
    [SCRIPT_ID]: 'custentity_depends_on_2',
    label: new ReferenceExpression(dependsOn1Instance.elemID.createNestedID(SCRIPT_ID),
      dependsOn1Instance.value[SCRIPT_ID], dependsOn1Instance),
    description: new ReferenceExpression(customFieldInstance.elemID.createNestedID('label'),
      customFieldInstance.value.label, customFieldInstance),
    help: new ReferenceExpression(anotherAdapterInstance.elemID.createNestedID('id'),
      anotherAdapterInstance.value.id, anotherAdapterInstance),
  })

  const changes = [toChange({ after: instanceWithManyRefs }),
    toChange({ after: dependsOn1Instance }),
    toChange({ after: fileInstance }),
    toChange({ after: customFieldInstance })]

  it('should return no change errors when there are no invalid elements from other change validators', () => {
    expect(validateDependsOnInvalidElement(new Set(), changes)).toEqual([])
  })

  it('should return no change errors if no other change depends on an invalid element', () => {
    expect(
      validateDependsOnInvalidElement(
        new Set(
          [instanceWithManyRefs.elemID.getFullName(), customFieldInstance.elemID.getFullName()]
        ),
        changes
      )
    ).toEqual([])
  })

  it('should return change errors for all changes that depend on an invalid element including deep dependency', () => {
    expect(validateDependsOnInvalidElement(new Set([fileInstance.elemID.getFullName()]), changes))
      .toEqual(expect.arrayContaining([
        expect.objectContaining({
          elemID: dependsOn1Instance.elemID,
        }),
        expect.objectContaining({
          elemID: instanceWithManyRefs.elemID,
        })]))
  })

  it('should return change error for change that depends on an invalid element', () => {
    expect(
      validateDependsOnInvalidElement(new Set([dependsOn1Instance.elemID.getFullName()]), changes)
    ).toEqual(expect.arrayContaining([
      expect.objectContaining({
        elemID: instanceWithManyRefs.elemID,
      })]))
  })
})
