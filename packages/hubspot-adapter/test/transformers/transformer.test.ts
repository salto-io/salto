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
import { InstanceElement, ElemID, Values, ObjectType, Field, BuiltinTypes, CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { HUBSPOT } from '../../src/constants'
import {
  createInstanceName, transformAfterUpdateOrAdd, createHubspotMetadataFromInstanceElement, Types,
} from '../../src/transformers/transformer'
import {
  HubspotMetadata, Form,
} from '../../src/client/types'
import { afterFormInstanceValuesMock } from '../common/mock_elements'

describe('Transformer', () => {
  describe('transformAfterUpdateOrAdd func', () => {
    let transformed: InstanceElement

    const mockTypeElemID = new ElemID(HUBSPOT, 'mockType')
    const mockSubTypeElemID = new ElemID(HUBSPOT, 'mockSubType')

    const result = {
      name: 'name',
      autoGen: 'id',
      subType: {
        subSame: 'a1',
        subAutoGen: 'b1',
      },
      listSubType: [
        {
          subSame: 'a1',
          subAutoGen: 'b1',
        },
      ],
      list: ['a', 'b'],
      diff: 'diffResult',
      notInType: 'notInType',
    } as HubspotMetadata

    const instanceValues = {
      name: 'name',
      subType: {
        subSame: 'a1',
      },
      listSubType: [
        {
          subSame: 'a1',
        },
      ],
      list: ['a', 'b', 'c'],
      diff: 'diffInstance',
    } as Values

    const mockSubType = new ObjectType({
      elemID: mockSubTypeElemID,
      fields: {
        subSame: new Field(
          mockSubTypeElemID, 'subSame', BuiltinTypes.STRING, {
            name: 'subSame',
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        subAutoGen: new Field(
          mockSubTypeElemID, 'subAutoGen', BuiltinTypes.STRING, {
            name: 'subAutoGen',
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
    })

    const mockObject = new ObjectType({
      elemID: mockTypeElemID,
      fields: {
        name: new Field(
          mockTypeElemID, 'name', BuiltinTypes.STRING, {
            name: 'name',
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        autoGen: new Field(
          mockTypeElemID, 'autoGen', BuiltinTypes.STRING, {
            name: 'autoGen',
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        subType: new Field(
          mockTypeElemID, 'subType', mockSubType, {
            name: 'subType',
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        listSubType: new Field(
          mockTypeElemID, 'listSubType', mockSubType, {
            name: 'listSubType',
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
        list: new Field(
          mockTypeElemID, 'list', BuiltinTypes.STRING, {
            name: 'list',
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
          true,
        ),
        diff: new Field(
          mockTypeElemID, 'diff', BuiltinTypes.STRING, {
            name: 'diff',
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
    })

    const instance = new InstanceElement(
      'mockInstance',
      mockObject,
      instanceValues
    )
    beforeEach(async () => {
      transformed = await transformAfterUpdateOrAdd(instance, result)
    })

    it('should return a transformed instance with values', () => {
      expect(transformed).toBeDefined()
      expect(transformed.value).toBeDefined()
    })

    it('should keep values from instance', () => {
      expect(transformed.value.name).toEqual(instance.value.name)
      expect(transformed.value.diff).toEqual(instance.value.diff)
      expect(transformed.value.subType).toBeDefined()
      expect(transformed.value.subType.subSame).toEqual(instance.value.subType.subSame)
      expect(transformed.value.listSubType).toBeDefined()
      expect(transformed.value.listSubType).toHaveLength(1)
      expect(transformed.value.listSubType[0].subSame).toEqual(
        instance.value.listSubType[0].subSame
      )
      expect(transformed.value.list).toEqual(instance.value.list)
    })

    it('should add new values from result', () => {
      const resultValues = result as Values
      expect(instance.value.autoGen).toEqual(resultValues.autoGen)
      expect(instance.value.subType.autoGen).toEqual(resultValues.subType.autoGen)
      expect(transformed.value.listSubType).toBeDefined()
      expect(transformed.value.listSubType).toHaveLength(1)
      expect(transformed.value.listSubType[0].autoGen).toEqual(resultValues.listSubType[0].autoGen)
    })

    it('should not include unsupported types', () => {
      expect(instance.value.notInType).toBeUndefined()
    })
  })

  describe('createHubspotMetadataFromInstanceElement func', () => {
    const mockTypeWithJSONElemID = new ElemID(HUBSPOT, 'mockType')
    const mockObjectWithJSON = new ObjectType({
      elemID: mockTypeWithJSONElemID,
      fields: {
        jsonType: new Field(
          mockTypeWithJSONElemID, 'jsonType', BuiltinTypes.JSON, {
            name: 'jsonType',
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        ),
      },
    })
    const jsonString = '{ "a": "b", "c": [ "1", "2", "3"] }'
    const mockValuesWithJSON = {
      name: 'jsonName',
      jsonType: jsonString,
    } as Values
    const instanceWithJson = new InstanceElement(
      'mockInstanceWithJSON',
      mockObjectWithJSON,
      mockValuesWithJSON
    )
    interface JSONMetadata extends HubspotMetadata {
      jsonType: JSONType
    }
    interface JSONType {
      a: string
      c: string[]
    }
    it('should parse JSON values', () => {
      const metadataResult = createHubspotMetadataFromInstanceElement(
        instanceWithJson
      ) as JSONMetadata
      expect(metadataResult.jsonType).toBeDefined()
      expect(metadataResult.jsonType).toEqual(JSON.parse(jsonString))
    })

    const formInstance = new InstanceElement(
      'mockFormInstance',
      Types.hubspotObjects.form,
      afterFormInstanceValuesMock
    )

    describe('handle form instances field transformation', () => {
      let formMetadata: Form
      beforeEach(() => {
        formMetadata = createHubspotMetadataFromInstanceElement(
          formInstance
        ) as Form
      })

      it('should keep fields with the same structure', () => {
        expect(formMetadata.formFieldGroups).toBeDefined()
        expect(formMetadata.formFieldGroups).toHaveLength(2)
        expect(formMetadata.formFieldGroups[0].fields).toBeDefined()
      })

      it('should merge contactProperty & field values according to override rules at base level', () => {
        // formFieldGroups[0] - field with dependent
        const fieldWithDependent = formMetadata.formFieldGroups[0].fields[0]
        expect(fieldWithDependent).toBeDefined()

        // Overidden
        expect(fieldWithDependent.label).toEqual(
          formInstance.value.formFieldGroups[0].fields[0]
            .contactPropertyOverrides.label
        )

        // From field
        expect(fieldWithDependent.required).toEqual(
          formInstance.value.formFieldGroups[0].fields[0].required
        )
        expect(fieldWithDependent.isSmartField).toEqual(
          formInstance.value.formFieldGroups[0].fields[0].isSmartField
        )
        expect(fieldWithDependent.defaultValue).toEqual(
          formInstance.value.formFieldGroups[0].fields[0].defaultValue
        )
        expect(fieldWithDependent.selectedOptions).toEqual(
          formInstance.value.formFieldGroups[0].fields[0].selectedOptions
        )
        expect(fieldWithDependent.placeholder).toEqual(
          formInstance.value.formFieldGroups[0].fields[0].placeholder
        )

        // From contactProperty
        expect(fieldWithDependent.name).toEqual(
          formInstance.value.formFieldGroups[0].fields[0]
            .contactProperty.resValue.value.name
        )
        expect(fieldWithDependent.displayOrder).toEqual(
          formInstance.value.formFieldGroups[0].fields[0]
            .contactProperty.resValue.value.displayOrder
        )
        expect(fieldWithDependent.description).toEqual(
          formInstance.value.formFieldGroups[0].fields[0]
            .contactProperty.resValue.value.description
        )
        expect(fieldWithDependent.options).toEqual(
          formInstance.value.formFieldGroups[0].fields[0]
            .contactProperty.resValue.value.options
        )


        // formFieldGroups[1] - field with options
        const fieldWithOptions = formMetadata.formFieldGroups[1].fields[0]
        expect(fieldWithOptions).toBeDefined()

        // Overidden
        expect(fieldWithOptions.options).toEqual(
          formInstance.value.formFieldGroups[1].fields[0]
            .contactPropertyOverrides.options
        )

        // From Field
        expect(fieldWithOptions.selectedOptions).toEqual(
          formInstance.value.formFieldGroups[1].fields[0].selectedOptions
        )
      })

      it('should merge dependentFieldFilters properly', () => {
        // dependentFieldFilters
        const { dependentFieldFilters } = formMetadata.formFieldGroups[0].fields[0]
        expect(dependentFieldFilters).toBeDefined()
        expect(dependentFieldFilters).toHaveLength(1)

        expect(dependentFieldFilters[0].formFieldAction).toEqual(
          formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0].formFieldAction
        )

        expect(dependentFieldFilters[0].filters).toBeDefined()
        expect(dependentFieldFilters[0].filters).toHaveLength(1)
        expect(dependentFieldFilters[0].filters[0]).toEqual(
          formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0].filters[0]
        )

        const { dependentFormField } = dependentFieldFilters[0]
        expect(dependentFormField).toBeDefined()

        // Overidden
        expect(dependentFormField.label).toEqual(
          formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0]
            .dependentFormField.contactPropertyOverrides.label
        )
        expect(dependentFormField.description).toEqual(
          formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0]
            .dependentFormField.contactPropertyOverrides.description
        )

        // From form field
        expect(dependentFormField.required).toEqual(
          formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0]
            .dependentFormField.required
        )
        expect(dependentFormField.isSmartField).toEqual(
          formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0]
            .dependentFormField.isSmartField
        )
        expect(dependentFormField.defaultValue).toEqual(
          formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0]
            .dependentFormField.defaultValue
        )
        expect(dependentFormField.selectedOptions).toEqual(
          formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0]
            .dependentFormField.selectedOptions
        )
        expect(dependentFormField.placeholder).toEqual(
          formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0]
            .dependentFormField.placeholder
        )

        // From contactProperty
        expect(dependentFormField.name).toEqual(
          formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0]
            .dependentFormField.contactProperty.resValue.value.name
        )
        expect(dependentFormField.displayOrder).toEqual(
          formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0]
            .dependentFormField.contactProperty.resValue.value.displayOrder
        )
        expect(dependentFormField.options).toEqual(
          formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0]
            .dependentFormField.contactProperty.resValue.value.options
        )
      })
    })
  })

  describe('createInstanceName func', () => {
    const instanceTestName = 'instance test name'
    const mockGuid = 'id1234'
    const mockId = 54321
    const hubMetadataType = {
      name: instanceTestName,
      bla: false,
      guid: mockGuid,
      id: mockId,
    } as HubspotMetadata

    it('should return instance name', async () => {
      const resp = createInstanceName(hubMetadataType.name)
      expect(resp).toEqual('instance_test_name')
    })

    it('should replace all spaces with underscore', async () => {
      const resp = createInstanceName(' name secondName ')
      expect(resp).toEqual('name_secondName')
    })
  })
})
