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
import { ElemID, ObjectType, Element, CORE_ANNOTATIONS, PrimitiveType, PrimitiveTypes, FieldDefinition, isInstanceElement, InstanceElement } from '@salto-io/adapter-api'
import { getNamespaceFromString } from '../../src/filters/utils'
import { FilterWith } from '../../src/filter'
import SalesforceClient from '../../src/client/client'
import Connection from '../../src/client/jsforce'
import filterCreator from '../../src/filters/custom_objects_instances'
import mockAdapter from '../adapter'
import {
  LABEL, CUSTOM_OBJECT, API_NAME, METADATA_TYPE, SALESFORCE, INSTALLED_PACKAGES_PATH,
  OBJECTS_PATH, RECORDS_PATH,
} from '../../src/constants'
import { Types } from '../../src/transformers/transformer'

describe('Custom Object Instances filter', () => {
  let connection: Connection
  let client: SalesforceClient
  type FilterType = FilterWith<'onFetch'>
  let filter: FilterType

  const TestCustomRecords = [
    {
      attributes: {
        type: 'Test',
      },
      Id: 'abcdefg',
      OtherAddress: {
        city: 'city',
        counry: 'country',

      },
      Name: 'Name',
      FirstName: 'First',
      LastName: 'Last',
      TestField: 'Test',
    },
    {
      attributes: {
        type: 'Test',
      },
      Id: 'hijklmn',
      OtherAddress: {
        city: 'citizen',
        counry: 'countrizen',
      },
      Name: 'Namizen',
      FirstName: 'Firstizen',
      LastName: 'Lastizen',
      TestField: 'testizen',
    },
  ]

  const stringType = new PrimitiveType({
    elemID: new ElemID(SALESFORCE, 'string'),
    primitive: PrimitiveTypes.STRING,
  })

  const createCustomObject = (
    name: string,
    additionalFields?: Record<string, FieldDefinition>
  ): ObjectType => {
    const namespace = getNamespaceFromString(name)
    const basicFields = {
      Name: {
        type: stringType,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [LABEL]: 'description label',
          [API_NAME]: 'Name',
        },
      },
      TestField: {
        type: stringType,
        annotations: {
          [LABEL]: 'Test field',
          [API_NAME]: 'TestField',
        },
      },
    }
    const obj = new ObjectType({
      elemID: new ElemID(SALESFORCE, name),
      annotations: {
        [API_NAME]: name,
        [METADATA_TYPE]: CUSTOM_OBJECT,
      },
      fields: additionalFields ? Object.assign(basicFields, additionalFields) : basicFields,
    })
    const path = namespace
      ? [SALESFORCE, INSTALLED_PACKAGES_PATH, namespace, OBJECTS_PATH, obj.elemID.name]
      : [SALESFORCE, OBJECTS_PATH, obj.elemID.name]
    obj.path = path
    return obj
  }

  let basicQueryImplementation: jest.Mock

  const testNamespace = 'TestNamespace'

  beforeEach(() => {
    ({ connection, client } = mockAdapter({
      adapterParams: {
      },
    }))
    filter = filterCreator(
      { client, config: { namespacesToFetchInstancesFor: [testNamespace] } }
    ) as FilterType
    basicQueryImplementation = jest.fn().mockImplementation(async () => (
      {
        totalSize: 2,
        done: true,
        records: TestCustomRecords,
      }))
    connection.query = basicQueryImplementation
  })

  describe('When all CustomObjects not from namespace', () => {
    let elements: Element[]
    const firstObjName = 'NotInNameSpaceA'
    const firstElement = createCustomObject(firstObjName)
    const secondObjName = 'NotInNameSpaceB'
    const secondElement = createCustomObject(secondObjName)
    beforeEach(async () => {
      elements = [firstElement, secondElement]
      await filter.onFetch(elements)
    })

    it('should not add elements', () => {
      expect(elements.length).toEqual(2)
    })

    it('should not change existing elements', () => {
      const first = elements.filter(e => e.annotations[API_NAME] === firstObjName)[0]
      expect(first).toBeDefined()
      expect(first).toEqual(firstElement)
      const second = elements.filter(e => e.annotations[API_NAME] === secondObjName)[0]
      expect(second).toBeDefined()
      expect(second).toEqual(secondElement)
    })
  })

  describe('When some CustomObjects are from the namespace', () => {
    let elements: Element[]
    const simpleName = 'TestNamespace__simple__c'
    const simpleObject = createCustomObject(simpleName)

    const withNameName = 'TestNamespace__withCompoundName__c'
    const objWithNameField = createCustomObject(withNameName)
    objWithNameField.fields.Name.type = Types.compoundDataTypes.Name

    const withAddressName = 'TestNamespace__withAddress__c'
    const objWithAddressField = createCustomObject(withAddressName, {
      OtherAddress: {
        type: Types.compoundDataTypes.Address,
        annotations: {
          [LABEL]: 'Address',
          [API_NAME]: 'OtherAddress',
        },
      },
    })

    const notInNamespaceName = 'NotInNamespace__c'
    const objNotInNamespace = createCustomObject(notInNamespaceName)

    beforeEach(async () => {
      elements = [simpleObject, objWithNameField, objWithAddressField, objNotInNamespace]
      await filter.onFetch(elements)
    })

    it('should add instances per namespaced object', () => {
      // 2 new instances per namespaced object because of TestCustomRecords's length
      expect(elements.length).toEqual(10)
      expect(elements.filter(e => isInstanceElement(e)).length).toEqual(6)
    })

    describe('simple object', () => {
      let instances: InstanceElement[]
      beforeEach(() => {
        instances = elements.filter(
          e => isInstanceElement(e) && e.type === simpleObject
        ) as InstanceElement[]
      })

      it('should call query with the object fields', () => {
        expect(basicQueryImplementation).toHaveBeenCalledWith(`SELECT Name,TestField FROM ${simpleName}`)
      })

      it('should create instances according to results', () => {
        expect(instances.length).toEqual(2)
      })

      it('should create the instances with record path acccording to object', () => {
        expect(instances[0].path).toEqual(
          [SALESFORCE, INSTALLED_PACKAGES_PATH, testNamespace,
            RECORDS_PATH, simpleName, TestCustomRecords[0].Id]
        )
      })

      it('should create instance with values according to objects fields', () => {
        const { value } = instances[0]
        expect(value.Name).toEqual('Name')
        expect(value.TestField).toEqual('Test')
      })
    })

    describe('object with compound Name', () => {
      let instances: InstanceElement[]
      beforeEach(() => {
        instances = elements.filter(
          e => isInstanceElement(e) && e.type === objWithNameField
        ) as InstanceElement[]
      })

      it('should call query with the object fields', () => {
        expect(basicQueryImplementation).toHaveBeenCalledWith(`SELECT FirstName,LastName,Salutation,TestField FROM ${withNameName}`)
      })

      it('should create instances according to results', () => {
        expect(instances.length).toEqual(2)
      })

      it('should create the instances with record path acccording to object', () => {
        expect(instances[0].path).toEqual(
          [SALESFORCE, INSTALLED_PACKAGES_PATH, testNamespace,
            RECORDS_PATH, withNameName, TestCustomRecords[0].Id]
        )
      })

      it('should create instance with values according to objects fields', () => {
        const { value } = instances[0]
        // Name is compound so First & Last name values should be inside Name
        expect(value.LastName).toBeUndefined()
        expect(value.FirstName).toBeUndefined()
        expect(value.Name).toEqual({
          FirstName: 'First',
          LastName: 'Last',
        })
        expect(value.TestField).toEqual('Test')
      })
    })

    describe('object with compound Address', () => {
      let instances: InstanceElement[]
      beforeEach(() => {
        instances = elements.filter(
          e => isInstanceElement(e) && e.type === objWithAddressField
        ) as InstanceElement[]
      })

      it('should call query with the object fields', () => {
        expect(basicQueryImplementation).toHaveBeenCalledWith(`SELECT Name,TestField,OtherAddress FROM ${withAddressName}`)
      })

      it('should create instances according to results', () => {
        expect(instances.length).toEqual(2)
      })

      it('should create the instances with record path acccording to object', () => {
        expect(instances[0].path).toEqual(
          [SALESFORCE, INSTALLED_PACKAGES_PATH, testNamespace,
            RECORDS_PATH, withAddressName, TestCustomRecords[0].Id]
        )
      })

      it('should create instance with values according to objects fields', () => {
        const { value } = instances[0]
        expect(value.Name).toEqual('Name')
        expect(value.TestField).toEqual('Test')
        expect(value.OtherAddress).toEqual({
          city: 'city',
          counry: 'country',
        })
      })
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })
})
