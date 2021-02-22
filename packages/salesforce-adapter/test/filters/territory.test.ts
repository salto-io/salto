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
import { ObjectType, ElemID, BuiltinTypes } from '@salto-io/adapter-api'
import { FilterWith } from '../../src/filter'
import filterCreator from '../../src/filters/territory'
import mockClient from '../client'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import { createInstanceElement, MetadataInstanceElement } from '../../src/transformers/transformer'
import { SALESFORCE, TERRITORY2_TYPE } from '../../src/constants'

const createMetadataTypeElement = (
  typeName: string,
  params: Partial<ConstructorParameters<typeof ObjectType>[0]>
): ObjectType => new ObjectType({
  ...params,
  annotations: {
    ...params.annotations,
    metadataType: typeName,
  },
  elemID: new ElemID(SALESFORCE, typeName),
})

describe('territory filter', () => {
  let filter: FilterWith<'onFetch'>
  beforeEach(() => {
    filter = filterCreator({
      client: mockClient().client,
      config: { fetchProfile: buildFetchProfile({}) },
    }) as typeof filter
  })
  describe('onFetch', () => {
    let type: ObjectType
    let instance: MetadataInstanceElement
    beforeEach(async () => {
      type = createMetadataTypeElement(
        TERRITORY2_TYPE,
        {
          fields: {
            customFields: { type: new ObjectType({ elemID: new ElemID(SALESFORCE, 'FieldValue') }) },
            description: { type: BuiltinTypes.STRING },
          },
        }
      )
      instance = createInstanceElement(
        {
          fullName: 'TerModel.Territory',
          description: 'Desc',
          customFields: [
            { name: 'f__c', value: { 'attr_xsi:type': 'xsd:boolean', '#text': 'false' } },
          ],
        },
        type,
      )
      await filter.onFetch([type, instance])
    })
    it('should remove custom fields from instance', () => {
      expect(instance.value).not.toHaveProperty('customFields')
    })
    it('should keep other values on instance', () => {
      expect(instance.value).toHaveProperty('description', 'Desc')
    })
    it('should remove custom fields from type fields', () => {
      expect(type.fields).not.toHaveProperty('customFields')
    })
    it('should keep other fields on type', () => {
      expect(type.fields).toHaveProperty(
        'description',
        expect.objectContaining({ type: BuiltinTypes.STRING })
      )
    })
  })
})
