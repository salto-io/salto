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
import { buildFetchProfile } from '../../../src/fetch_profile/fetch_profile'
import { SalesforceClient } from '../../../index'
import filterCreator from '../../../src/filters/tooling/fetch_tooling_types'
import mockClient from '../../client'
import { defaultFilterContext } from '../../utils'
import { FilterWith } from '../../../src/filter'
import { SupportedToolingObject, ToolingObjectAnnotation } from '../../../src/tooling/constants'
import { API_NAME, SALESFORCE, TYPES_PATH } from '../../../src/constants'
import { getRenamedTypeName } from '../../../src/transformers/transformer'

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
      elements = []
    })

    describe('when ToolingObject type is not excluded from the config', () => {
      beforeEach(async () => {
        const filter = filterCreator({ client, config: defaultFilterContext }) as FilterWith<'onFetch'>
        await filter.onFetch(elements)
      })

      it('should create ObjectType per supported tooling type', () => {
        expect(elements.length).toEqual(Object.keys(SupportedToolingObject).length)
        Object.keys(SupportedToolingObject).forEach(toolingObjectName => {
          const typeName = getRenamedTypeName(toolingObjectName)
          expect(elements).toContainEqual(expect.objectContaining({
            elemID: expect.objectContaining({ typeName }),
            path: [SALESFORCE, TYPES_PATH, typeName],
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

    describe('when all the supported tooling types are excluded from the config', () => {
      beforeEach(async () => {
        const filterContext = {
          ...defaultFilterContext,
          fetchProfile: buildFetchProfile({
            metadata: {
              exclude: Object.keys(SupportedToolingObject)
                .map(toolingObjectName => getRenamedTypeName(toolingObjectName))
                .map(typeName => ({ metadataType: typeName })),
            },
          }),
        }
        const filter = filterCreator({ client, config: filterContext }) as FilterWith<'onFetch'>
        await filter.onFetch(elements)
      })
      it('should not create any ObjectType', () => {
        expect(elements).toBeEmpty()
      })
    })
  })
})
