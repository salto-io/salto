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
  InstanceElement, ElemID, Values, ObjectType, BuiltinTypes, CORE_ANNOTATIONS, ListType,
} from '@salto-io/adapter-api'
import { RequestPromise } from 'requestretry'
import HubspotClient from '../../src/client/client'
import mockClient from '../client'
import { HUBSPOT, OBJECTS_NAMES } from '../../src/constants'
import {
  createInstanceName, transformAfterUpdateOrAdd, createHubspotMetadataFromInstanceElement,
  Types, getLookUpName,
} from '../../src/transformers/transformer'
import {
  HubspotMetadata, Form,
} from '../../src/client/types'
import { afterFormInstanceValuesMock } from '../common/mock_elements'
import { useridentifierObjectType } from '../common/mock_types'

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
        subSame: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: 'subSame',
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        subAutoGen: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: 'subAutoGen',
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
      },
    })

    const mockObject = new ObjectType({
      elemID: mockTypeElemID,
      fields: {
        name: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: 'name',
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        autoGen: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: 'autoGen',
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        subType: {
          type: mockSubType,
          annotations: {
            name: 'subType',
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        listSubType: {
          type: new ListType(mockSubType),
          annotations: {
            name: 'listSubType',
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        list: {
          type: new ListType(BuiltinTypes.STRING),
          annotations: {
            name: 'list',
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        diff: {
          type: BuiltinTypes.STRING,
          annotations: {
            name: 'diff',
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
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
      expect(transformed.value.autoGen).toEqual(resultValues.autoGen)
      expect(transformed.value.subType.autoGen).toEqual(resultValues.subType.autoGen)
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
        jsonType: {
          type: BuiltinTypes.JSON,
          annotations: {
            name: 'jsonType',
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
        jsonTypeFileValue: {
          type: BuiltinTypes.JSON,
          annotations: {
            name: 'jsonTypeFileValue',
            _readOnly: false,
            [CORE_ANNOTATIONS.REQUIRED]: false,
          },
        },
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
      jsonTypeFileValue: JSONType
    }
    interface JSONType {
      a: string
      c: string[]
    }
    let hsClient: HubspotClient
    beforeEach(() => {
      const { client } = mockClient()
      hsClient = client
      const getOwners = async (): Promise<RequestPromise> => Promise.resolve([
        {
          activeUserId: 12,
          email: 'a@b.com',
        },
        {
          activeUserId: 34,
          email: 'c@d.com',
        },
        {
          activeUserId: 56,
          email: 'e@f.com',
        }]) as unknown as RequestPromise
      hsClient.getOwners = jest.fn().mockImplementation(getOwners)
    })

    describe('handle JSON values', () => {
      let metadataResult: JSONMetadata
      beforeAll(async () => {
        metadataResult = await createHubspotMetadataFromInstanceElement(
          instanceWithJson,
          hsClient
        ) as JSONMetadata
      })

      it('from string value', async () => {
        expect(metadataResult.jsonType).toBeDefined()
        expect(metadataResult.jsonType).toEqual(JSON.parse(jsonString))
      })
    })

    describe('handle useridentity', () => {
      interface UserIdentityMetadata extends HubspotMetadata {
        str: string
        simple: number
        simpleNum: number
        stringList: string
        stringArray: string
        objField: UserIdentityMetadata
        listOfObjField: UserIdentityMetadata[]
        listOfListOfObjField: UserIdentityMetadata[][]
        listOfListOfListOfObjField: UserIdentityMetadata[][][]
      }
      let userIdentityInstanceValues: Values
      let mockUseridentityInstance: InstanceElement
      let metadataResult: UserIdentityMetadata
      beforeEach(async () => {
        userIdentityInstanceValues = {
          str: 'a@b.com',
          simple: 'a@b.com',
          simpleNum: '101',
          stringList: ['a@b.com', 'c@d.com', 'e@f.com', 'no@owner.com'],
          stringArray: ['a@b.com', 'c@d.com', 'e@f.com'],
          objField: {
            str: 'a@b.com',
            simpleNum: '101',
            simple: 'a@b.com',
            stringList: ['a@b.com', 'c@d.com', 'e@f.com', 'no@owner.com'],
            stringArray: ['a@b.com', 'c@d.com', 'e@f.com'],
          },
          listOfObjField: [
            {
              str: 'a@b.com',
              simple: 'a@b.com',
              simpleNum: '101',
              stringList: ['a@b.com', 'c@d.com', 'e@f.com', 'no@owner.com'],
              stringArray: ['a@b.com', 'c@d.com', 'e@f.com'],
            },
            {
              str: 'c@d.com',
              simple: 'c@d.com',
              stringList: ['c@d.com', 'e@f.com', 'a@b.com'],
              stringArray: ['c@d.com', 'e@f.com', 'a@b.com'],
            },
          ],
          listOfListOfObjField: [
            [
              {
                str: 'a@b.com',
                simple: 'a@b.com',
                simpleNum: '101',
                stringList: ['a@b.com', 'c@d.com', 'e@f.com', 'no@owner.com'],
                stringArray: ['a@b.com', 'c@d.com', 'e@f.com'],
              },
              {
                str: 'c@d.com',
                simple: 'c@d.com',
                stringList: ['c@d.com', 'e@f.com', 'a@b.com'],
                stringArray: ['c@d.com', 'e@f.com', 'a@b.com'],
              },
            ],
            [
              {
                str: 'c@d.com',
                simple: 'c@d.com',
                stringList: ['c@d.com', 'e@f.com', 'a@b.com'],
                stringArray: ['c@d.com', 'e@f.com', 'a@b.com'],
              },
              {
                str: 'a@b.com',
                simple: 'a@b.com',
                simpleNum: '101',
                stringList: ['a@b.com', 'c@d.com', 'e@f.com', 'no@owner.com'],
                stringArray: ['a@b.com', 'c@d.com', 'e@f.com'],
              },
            ],
          ],
          listOfListOfListOfObjField: [
            [
              [
                {
                  str: 'a@b.com',
                  simple: 'a@b.com',
                  simpleNum: '101',
                  stringList: ['a@b.com', 'c@d.com', 'e@f.com', 'no@owner.com'],
                  stringArray: ['a@b.com', 'c@d.com', 'e@f.com'],
                },
                {
                  str: 'c@d.com',
                  simple: 'c@d.com',
                  stringList: ['c@d.com', 'e@f.com', 'a@b.com'],
                  stringArray: ['c@d.com', 'e@f.com', 'a@b.com'],
                },
              ],
            ],
          ],
        } as Values
        mockUseridentityInstance = new InstanceElement(
          'mockUseridentityInstance',
          useridentifierObjectType,
          userIdentityInstanceValues
        )
        metadataResult = await createHubspotMetadataFromInstanceElement(
          mockUseridentityInstance,
          hsClient
        ) as UserIdentityMetadata
      })

      describe('should convert at top level', () => {
        it('should not change non-useridentity values at top level', () => {
          expect(metadataResult.str).toEqual(userIdentityInstanceValues.str)
        })

        it('should convert simple email to id at top level', () => {
          expect(metadataResult.simple).toEqual(12)
        })

        it('should convert useridentifier string number to number at top level', () => {
          expect(metadataResult.simpleNum).toEqual(101)
        })

        it('should convert array to string list at top level', () => {
          expect(metadataResult.stringList).toEqual('12,34,56,no@owner.com')
        })
      })

      describe('should convert inside obj', () => {
        it('should not change non-useridentity values inside obj', () => {
          expect(metadataResult.objField.str).toEqual(userIdentityInstanceValues.objField.str)
        })

        it('should convert simple email to id inside obj', () => {
          expect(metadataResult.objField.simple).toEqual(12)
        })

        it('should convert useridentifier string number to number inside obj', () => {
          expect(metadataResult.objField.simpleNum).toEqual(101)
        })

        it('should convert array to string list inside obj', () => {
          expect(metadataResult.objField.stringList).toEqual('12,34,56,no@owner.com')
        })
      })

      describe('should convert inside list of obj', () => {
        it('should not change non-useridentity values inside list of obj', () => {
          expect(metadataResult.listOfObjField[0].str)
            .toEqual(userIdentityInstanceValues.listOfObjField[0].str)
        })

        it('should convert simple email to id inside list of obj', () => {
          expect(metadataResult.listOfObjField[0].simple).toEqual(12)
        })

        it('should convert useridentifier string number to number inside list of obj', () => {
          expect(metadataResult.listOfObjField[0].simpleNum).toEqual(101)
        })

        it('should convert array to string list inside list of obj', () => {
          expect(metadataResult.listOfObjField[0].stringList).toEqual('12,34,56,no@owner.com')
        })
      })

      describe('should convert inside list of list of obj', () => {
        it('should not change non-useridentity values inside list of list of obj', () => {
          expect(metadataResult.listOfListOfObjField[0][0].str)
            .toEqual(userIdentityInstanceValues.listOfObjField[0].str)
        })

        it('should convert simple email to id inside list of list of obj', () => {
          expect(metadataResult.listOfListOfObjField[0][0].simple).toEqual(12)
        })

        it('should convert useridentifier string number to number inside list of list of obj', () => {
          expect(metadataResult.listOfListOfObjField[0][0].simpleNum).toEqual(101)
        })

        it('should convert array to string list inside list of list of obj', () => {
          expect(metadataResult.listOfListOfObjField[0][0].stringList).toEqual('12,34,56,no@owner.com')
        })
      })

      describe('should convert inside list of list of list of obj', () => {
        it('should not change non-useridentity values inside list of list of list of obj', () => {
          expect(metadataResult.listOfListOfListOfObjField[0][0][0].str)
            .toEqual(userIdentityInstanceValues.listOfObjField[0].str)
        })

        it('should convert simple email to id inside list of list of list of obj', () => {
          expect(metadataResult.listOfListOfListOfObjField[0][0][0].simple).toEqual(12)
        })

        it('should convert useridentifier string number to number inside list of list of list of obj', () => {
          expect(metadataResult.listOfListOfListOfObjField[0][0][0].simpleNum).toEqual(101)
        })

        it('should convert array to string list inside list of list of list of obj', () => {
          expect(metadataResult.listOfListOfListOfObjField[0][0][0].stringList).toEqual('12,34,56,no@owner.com')
        })
      })
    })

    const formInstance = new InstanceElement(
      'mockFormInstance',
      Types.hubspotObjects[OBJECTS_NAMES.FORM],
      afterFormInstanceValuesMock
    )

    describe('handle form instances field transformation', () => {
      let formMetadata: Form
      beforeEach(async () => {
        formMetadata = await createHubspotMetadataFromInstanceElement(
          formInstance,
          hsClient
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

        // Overridden
        expect(fieldWithDependent.label).toEqual(
          formInstance.value.formFieldGroups[0].fields[0]
            .contactPropertyOverrides.label
        )

        // Overridden by helpText (special case for description)
        expect(fieldWithDependent.description).toEqual(
          formInstance.value.formFieldGroups[0].fields[0].helpText
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
            .contactProperty.value.name
        )
        expect(fieldWithDependent.displayOrder).toEqual(
          formInstance.value.formFieldGroups[0].fields[0]
            .contactProperty.value.displayOrder
        )
        expect(fieldWithDependent.options).toEqual(
          formInstance.value.formFieldGroups[0].fields[0]
            .contactProperty.value.options
        )


        // formFieldGroups[1] - field with options
        const fieldWithOptions = formMetadata.formFieldGroups[1].fields[0]
        expect(fieldWithOptions).toBeDefined()

        // Overridden
        expect(fieldWithOptions.options).toEqual(
          formInstance.value.formFieldGroups[1].fields[0]
            .contactPropertyOverrides.options
        )

        // Overridden by '' if helpText is empty (special case for description)
        expect(fieldWithOptions.description).toEqual('')

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

        // Overridden
        expect(dependentFormField.label).toEqual(
          formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0]
            .dependentFormField.contactPropertyOverrides.label
        )

        // Overridden by helpText (special description case)
        expect(dependentFormField.description).toEqual(
          formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0]
            .dependentFormField.helpText
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
            .dependentFormField.contactProperty.value.name
        )
        expect(dependentFormField.displayOrder).toEqual(
          formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0]
            .dependentFormField.contactProperty.value.displayOrder
        )
        expect(dependentFormField.options).toEqual(
          formInstance.value.formFieldGroups[0].fields[0].dependentFieldFilters[0]
            .dependentFormField.contactProperty.value.options
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

  describe('getLookUpName func', () => {
    const instanceTestName = 'instance test name'
    const mockGuid = 'id1234'
    const mockId = 54321
    const hubMetadataType = {
      name: instanceTestName,
      bla: false,
      guid: mockGuid,
      id: mockId,
    } as HubspotMetadata

    it('should replace all spaces with underscore', async () => {
      expect(getLookUpName(hubMetadataType)).toEqual(hubMetadataType)
    })
  })
})
