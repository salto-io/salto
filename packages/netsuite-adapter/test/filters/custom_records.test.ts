/*
*                      Copyright 2022 Salto Labs Ltd.
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
import { BuiltinTypes, ElemID, InstanceElement, ObjectType, ReferenceExpression, toChange } from '@salto-io/adapter-api'
import { NETSUITE } from '../../src/constants'
import filterCreator from '../../src/filters/custom_records'

describe('fix custom record objects filter', () => {
  let type: ObjectType
  let instance: InstanceElement
  describe('onFetch', () => {
    beforeEach(async () => {
      type = new ObjectType({
        elemID: new ElemID(NETSUITE, 'custrecord'),
        fields: {
          scriptid: { refType: BuiltinTypes.SERVICE_ID },
          internalId: { refType: BuiltinTypes.STRING },
          custom_field: { refType: BuiltinTypes.STRING },
        },
        annotations: {
          metadataType: 'customrecordtype',
        },
      })
      instance = new InstanceElement(
        'record1',
        type,
        {
          recType: { internalId: '1' },
          owner: { internalId: '1' },
          translationsList: {
            customRecordTranslations: {
              lang: 'english',
            },
          },
        }
      )
      await filterCreator().onFetch([
        type,
        instance,
      ])
    })
    it('should remove fields from type', () => {
      expect(Object.keys(type.fields)).toEqual([
        'scriptid',
        'internalId',
        'custom_field',
      ])
    })
  })
  describe('preDeploy', () => {
    beforeEach(async () => {
      type = new ObjectType({
        elemID: new ElemID(NETSUITE, 'custrecord'),
        annotations: {
          metadataType: 'customrecordtype',
        },
      })
      instance = new InstanceElement(
        'record1',
        type,
        { internalId: '2' }
      )
      await filterCreator().preDeploy([toChange({ after: instance })])
    })
    it('should add fields to type', () => {
      expect(Object.keys(type.fields)).toEqual([
        'parent',
        'recType',
      ])
    })
    it('should add recordType to instance', () => {
      expect(instance.value.recType).toEqual(new ReferenceExpression(type.elemID, type))
    })
  })
})
