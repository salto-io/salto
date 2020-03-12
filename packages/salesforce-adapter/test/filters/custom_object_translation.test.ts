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
  ObjectType, InstanceElement, Field, BuiltinTypes, ElemID, ReferenceExpression,
} from '@salto-io/adapter-api'
import filterCreator from '../../src/filters/custom_object_translation'
import {
  SALESFORCE, CUSTOM_OBJECT_TRANSLATION_METADATA_TYPE, METADATA_TYPE, CUSTOM_OBJECT, API_NAME,
  VALIDATION_RULES_METADATA_TYPE,
  INSTANCE_FULL_NAME_FIELD,
} from '../../src/constants'
import { FilterWith } from '../../src/filter'

describe('custom object translation filter', () => {
  const customObjName = 'MockCustomObject'
  const customFieldName = 'MockField'
  const customObjElemID = new ElemID(SALESFORCE, customObjName)
  const customObject = new ObjectType(
    {
      elemID: customObjElemID,
      fields: {
        [customFieldName]: new Field(customObjElemID, customFieldName, BuiltinTypes.STRING),
      },
      annotations: {
        [METADATA_TYPE]: CUSTOM_OBJECT,
        [API_NAME]: customObjName,
      },
    }
  )
  const validationRuleName = 'Last_Price'
  const validationRuleType = new ObjectType({
    elemID: new ElemID(SALESFORCE, VALIDATION_RULES_METADATA_TYPE),
    annotations: { [METADATA_TYPE]: VALIDATION_RULES_METADATA_TYPE },
  })
  const validationRuleInstance = new InstanceElement(
    `${customObjName}_${validationRuleName}`,
    validationRuleType,
    { [INSTANCE_FULL_NAME_FIELD]: `${customObjName}.${validationRuleName}` }
  )
  const objTranslationType = new ObjectType({
    elemID: new ElemID(SALESFORCE, CUSTOM_OBJECT_TRANSLATION_METADATA_TYPE),
  })
  const objTranslationInstance = new InstanceElement(
    `${customObjName}-en_US`,
    objTranslationType,
    {
      [INSTANCE_FULL_NAME_FIELD]: `${customObjName}-en_US`,
      fields: [{ name: customFieldName }, { name: 'not-exists' }],
      validationRules: [{ name: validationRuleName }, { name: 'not-exists' }],
    },
  )
  const objTranslationNoCustomObjInstance = new InstanceElement(
    'BLA-en_US',
    objTranslationType,
    {
      [INSTANCE_FULL_NAME_FIELD]: 'BLA-en_US',
      // Use here also single element and not a list
      fields: { name: customFieldName },
      validationRules: { name: validationRuleName },
    },
  )

  describe('on fetch', () => {
    let postFilter: InstanceElement
    let postFilterNoObj: InstanceElement

    beforeAll(async () => {
      const filter = filterCreator() as FilterWith<'onFetch'>
      const testElements = [
        objTranslationInstance.clone(),
        objTranslationNoCustomObjInstance.clone(),
        customObject.clone(),
        objTranslationType.clone(),
        validationRuleType.clone(),
        validationRuleInstance.clone(),
      ]
      await filter.onFetch(testElements)
      postFilter = testElements[0] as InstanceElement
      postFilterNoObj = testElements[1] as InstanceElement
    })

    describe('fields reference', () => {
      it('should transform fields to reference', async () => {
        expect(postFilter.value.fields[0].name)
          .toEqual(new ReferenceExpression(customObject.fields[customFieldName].elemID))
      })
      it('should keep name as is if no referenced field was found', async () => {
        expect(postFilter.value.fields[1].name).toBe('not-exists')
      })

      it('should keep name as is if no custom object', async () => {
        expect(postFilterNoObj.value.fields.name).toBe(customFieldName)
      })
    })

    describe('validation rules reference', () => {
      it('should transform validation rules to reference', async () => {
        expect(postFilter.value.validationRules[0].name)
          .toEqual(new ReferenceExpression(validationRuleInstance.elemID))
      })
      it('should keep name as is if no referenced validation rules was found', async () => {
        expect(postFilter.value.validationRules[1].name).toBe('not-exists')
      })

      it('should keep name as is if no custom object', async () => {
        expect(postFilterNoObj.value.validationRules.name).toBe(validationRuleName)
      })
    })
  })
})
