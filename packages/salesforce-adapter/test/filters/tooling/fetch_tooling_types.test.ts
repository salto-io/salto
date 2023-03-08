/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { CORE_ANNOTATIONS, Element } from '@salto-io/adapter-api'
import { DescribeSObjectResult } from 'jsforce'
import { SalesforceClient } from '../../../index'
import filterCreator from '../../../src/filters/tooling/fetch_tooling_types'
import mockClient from '../../client'
import { defaultFilterContext } from '../../utils'
import { FilterWith } from '../../../src/filter'
import { SupportedToolingObject, TOOLING_PATH, ToolingObjectAnnotation } from '../../../src/tooling/constants'
import { API_NAME } from '../../../src/constants'

describe('fetchToolingTypesFilter', () => {
  describe('onFetch', () => {
    let client: SalesforceClient
    let elements: Element[]

    const DESCRIBE_RESULT = {
      fields: [
        {
          aggregatable: true,
          aiPredictionField: false,
          autoNumber: false,
          byteLength: 18,
          calculated: false,
          calculatedFormula: null,
          cascadeDelete: false,
          caseSensitive: false,
          compoundFieldName: null,
          controllerName: null,
          createable: false,
          custom: false,
          defaultValue: null,
          defaultValueFormula: null,
          defaultedOnCreate: true,
          dependentPicklist: false,
          deprecatedAndHidden: false,
          digits: 0,
          displayLocationInDecimal: false,
          encrypted: false,
          externalId: false,
          extraTypeInfo: null,
          filterable: true,
          filteredLookupInfo: null,
          formulaTreatNullNumberAsZero: false,
          groupable: true,
          highScaleNumber: false,
          htmlFormatted: false,
          idLookup: true,
          inlineHelpText: null,
          label: 'Subscriber Package ID',
          length: 18,
          mask: null,
          maskType: null,
          name: 'Id',
          nameField: false,
          namePointing: false,
          nillable: false,
          permissionable: false,
          picklistValues: [],
          polymorphicForeignKey: false,
          precision: 0,
          queryByDistance: false,
          referenceTargetField: null,
          referenceTo: [],
          relationshipName: null,
          relationshipOrder: null,
          restrictedDelete: false,
          restrictedPicklist: false,
          scale: 0,
          searchPrefilterable: false,
          soapType: 'tns:ID',
          sortable: true,
          type: 'id',
          unique: false,
          updateable: false,
          writeRequiresMasterRead: false,
        },
        {
          aggregatable: true,
          aiPredictionField: false,
          autoNumber: false,
          byteLength: 240,
          calculated: false,
          calculatedFormula: null,
          cascadeDelete: false,
          caseSensitive: false,
          compoundFieldName: null,
          controllerName: null,
          createable: false,
          custom: false,
          defaultValue: null,
          defaultValueFormula: null,
          defaultedOnCreate: false,
          dependentPicklist: false,
          deprecatedAndHidden: false,
          digits: 0,
          displayLocationInDecimal: false,
          encrypted: false,
          externalId: false,
          extraTypeInfo: null,
          filterable: false,
          filteredLookupInfo: null,
          formulaTreatNullNumberAsZero: false,
          groupable: true,
          highScaleNumber: false,
          htmlFormatted: false,
          idLookup: true,
          inlineHelpText: null,
          label: 'Package Name',
          length: 80,
          mask: null,
          maskType: null,
          name: 'Name',
          nameField: true,
          namePointing: false,
          nillable: false,
          permissionable: false,
          picklistValues: [],
          polymorphicForeignKey: false,
          precision: 0,
          queryByDistance: false,
          referenceTargetField: null,
          referenceTo: [],
          relationshipName: null,
          relationshipOrder: null,
          restrictedDelete: false,
          restrictedPicklist: false,
          scale: 0,
          searchPrefilterable: false,
          soapType: 'xsd:string',
          sortable: true,
          type: 'string',
          unique: false,
          updateable: false,
          writeRequiresMasterRead: false,
        },
      ],
    } as unknown as DescribeSObjectResult
    const FIELD_NAMES = DESCRIBE_RESULT.fields.map(field => field.name)

    beforeEach(async () => {
      client = mockClient().client
      jest.spyOn(client, 'describeToolingObject').mockResolvedValue(DESCRIBE_RESULT)
      const filter = filterCreator({ client, config: defaultFilterContext }) as FilterWith<'onFetch'>
      elements = []
      await filter.onFetch(elements)
    })

    it('should create ObjectType per supported tooling type', () => {
      expect(elements.length).toEqual(Object.keys(SupportedToolingObject).length)
      Object.keys(SupportedToolingObject).forEach(toolingObjectName => {
        expect(elements).toContainEqual(expect.objectContaining({
          elemID: expect.objectContaining({ typeName: toolingObjectName }),
          path: [...TOOLING_PATH, toolingObjectName],
          fields: expect.toContainAllKeys(FIELD_NAMES),
          annotations: expect.objectContaining({
            [CORE_ANNOTATIONS.CREATABLE]: false,
            [CORE_ANNOTATIONS.UPDATABLE]: false,
            [CORE_ANNOTATIONS.DELETABLE]: false,
            [API_NAME]: toolingObjectName,
            [ToolingObjectAnnotation.isToolingObject]: true,
          }),
        }))
      })
    })
  })
})
