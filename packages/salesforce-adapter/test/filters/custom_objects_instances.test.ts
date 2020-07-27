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
import { ElemID, ObjectType, Element, CORE_ANNOTATIONS, PrimitiveType, PrimitiveTypes, FieldDefinition, isInstanceElement, InstanceElement, ServiceIds } from '@salto-io/adapter-api'
import { getNamespaceFromString } from '../../src/filters/utils'
import { FilterWith } from '../../src/filter'
import SalesforceClient from '../../src/client/client'
import Connection from '../../src/client/jsforce'
import filterCreator from '../../src/filters/custom_objects_instances'
import mockAdapter from '../adapter'
import {
  LABEL, CUSTOM_OBJECT, API_NAME, METADATA_TYPE, SALESFORCE, INSTALLED_PACKAGES_PATH,
  OBJECTS_PATH, RECORDS_PATH, FIELD_ANNOTATIONS,
} from '../../src/constants'
import { Types } from '../../src/transformers/transformer'

/* eslint-disable @typescript-eslint/camelcase */
describe('Custom Object Instances filter', () => {
  let connection: Connection
  let client: SalesforceClient
  type FilterType = FilterWith<'onFetch'>
  let filter: FilterType

  const NAME_FROM_GET_ELEM_ID = 'getElemIDPrefix'
  const mockGetElemIdFunc = (adapterName: string, _serviceIds: ServiceIds, name: string):
    ElemID => new ElemID(adapterName, `${NAME_FROM_GET_ELEM_ID}${name}`)

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
      Parent: 'hijklmn',
      Grandparent: 'hijklmn',
      Pricebook2Id: 'hijklmn',
      SBQQ__Location__c: 'Quote',
      SBQQ__DisplayOrder__c: 2,
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
      Parent: 'badId',
      Grandparent: 'abcdefg',
      Pricebook2Id: 'abcdefg',
      SBQQ__Location__c: 'Quote',
      SBQQ__DisplayOrder__c: 3,
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
  const disabledNamespace = 'DisabledNamespace'
  const anotherNamespace = 'AnotherNamespace'
  const nameBasedNamespace = 'NameBasedNamespace'
  const refFromNamespace = 'RefFromNamespace'
  const includeObjectName = 'IncludeThisObject'
  const excludeObjectName = 'TestNamespace__ExcludeMe__c'
  const excludeOverrideObjectName = 'ExcludeOverrideObject'
  const refToObjectName = 'RefTo'
  const refToFromNamespaceObjectName = 'RefFromNamespace__RefTo__c'
  const refFromAndToObjectName = 'RefFromAndTo'
  const emptyRefToObjectName = 'EmptyRefTo'

  beforeEach(() => {
    ({ connection, client } = mockAdapter({
      adapterParams: {
        getElemIdFunc: mockGetElemIdFunc,
      },
    }))
    filter = filterCreator(
      { client,
        config: {
          dataManagement: [
            {
              name: 'enabledWithNamespace',
              enabled: true,
              isNameBasedID: false,
              includeNamespaces: [testNamespace],
              excludeObjects: [excludeObjectName],
            },
            {
              name: 'disabledWithNamespace',
              enabled: false,
              isNameBasedID: false,
              includeNamespaces: [disabledNamespace],
            },
            {
              name: 'enabledWithNamespaceAndObject',
              enabled: true,
              isNameBasedID: false,
              includeNamespaces: [anotherNamespace],
              includeObjects: [includeObjectName, excludeOverrideObjectName],
            },
            {
              name: 'enabledWithExcludeObject',
              enabled: true,
              isNameBasedID: false,
              excludeObjects: [excludeOverrideObjectName],
            },
            {
              name: 'enabledWithNameID',
              enabled: true,
              isNameBasedID: true,
              includeNamespaces: [nameBasedNamespace],
              includeObjects: ['PricebookEntry', 'SBQQ__CustomAction__c'],
              allowReferenceTo: [refToObjectName],
            },
            {
              name: 'enabledWithReferenceTo',
              enabled: true,
              isNameBasedID: false,
              includeNamespaces: [refFromNamespace],
              includeObjects: [refFromAndToObjectName],
              allowReferenceTo: [
                refToObjectName, refToFromNamespaceObjectName,
                refFromAndToObjectName, emptyRefToObjectName,
              ],
            },
          ],
        } }
    ) as FilterType
    basicQueryImplementation = jest.fn().mockImplementation(async () => (
      {
        totalSize: 2,
        done: true,
        records: TestCustomRecords,
      }))
    connection.query = basicQueryImplementation
  })

  describe('Config filtering logic', () => {
    let elements: Element[]
    const notConfiguredObjName = 'NotInNameSpace'
    const notConfiguredObj = createCustomObject(notConfiguredObjName)

    const includedNamespaceObjName = `${testNamespace}__Included__c`
    const includedNameSpaceObj = createCustomObject(includedNamespaceObjName)

    const includedInAnotherNamespaceObjName = `${anotherNamespace}__Included__c`
    const includedInAnotherNamespaceObj = createCustomObject(includedInAnotherNamespaceObjName)

    const includedObject = createCustomObject(includeObjectName)
    const excludedObject = createCustomObject(excludeObjectName)
    const excludeOverrideObject = createCustomObject(excludeOverrideObjectName)
    beforeEach(async () => {
      elements = [
        notConfiguredObj, includedNameSpaceObj, includedInAnotherNamespaceObj,
        includedObject, excludedObject, excludeOverrideObject,
      ]
      await filter.onFetch(elements)
    })

    describe('should add instances per configured object', () => {
      it('should not fetch for non-configured objects', () => {
        const notConfiguredObjInstances = elements.filter(
          e => isInstanceElement(e) && e.type === notConfiguredObj
        ) as InstanceElement[]
        expect(notConfiguredObjInstances.length).toEqual(0)
      })

      it('should fetch for namespace configured objects', () => {
        const includedNameSpaceObjInstances = elements.filter(
          e => isInstanceElement(e) && e.type === includedNameSpaceObj
        ) as InstanceElement[]
        expect(includedNameSpaceObjInstances.length).toEqual(2)
      })

      it('should fetch for namespace configured objects in another conf object', () => {
        const includedInAnotherNamespaceObjInstances = elements.filter(
          e => isInstanceElement(e) && e.type === includedInAnotherNamespaceObj
        ) as InstanceElement[]
        expect(includedInAnotherNamespaceObjInstances.length).toEqual(2)
      })

      it('should fetch for object included specifically configured', () => {
        const includedObjectInstances = elements.filter(
          e => isInstanceElement(e) && e.type === includedObject
        ) as InstanceElement[]
        expect(includedObjectInstances.length).toEqual(2)
      })

      it('should not fetch for object from a configured namespace whose excluded specifically', () => {
        const excludedObjectInstances = elements.filter(
          e => isInstanceElement(e) && e.type === excludedObject
        ) as InstanceElement[]
        expect(excludedObjectInstances.length).toEqual(0)
      })

      it('should not fetch for object from a configured as excluded even if it was included by object', () => {
        const excludeOverrideObjectInstances = elements.filter(
          e => isInstanceElement(e) && e.type === excludeOverrideObject
        ) as InstanceElement[]
        expect(excludeOverrideObjectInstances.length).toEqual(0)
      })
    })

    it('should not change custom object elements', () => {
      const notConfiguredAfterFilter = elements
        .filter(e => e.annotations[API_NAME] === notConfiguredObjName)[0]
      expect(notConfiguredAfterFilter).toBeDefined()
      expect(notConfiguredAfterFilter).toEqual(notConfiguredObj)

      const includedNameSpaceObjFilter = elements
        .filter(e => e.annotations[API_NAME] === includedNamespaceObjName)[0]
      expect(includedNameSpaceObjFilter).toBeDefined()
      expect(includedNameSpaceObjFilter).toEqual(includedNameSpaceObj)

      const includedInAnotherNamespaceObjFilter = elements
        .filter(e => e.annotations[API_NAME] === includedInAnotherNamespaceObjName)[0]
      expect(includedInAnotherNamespaceObjFilter).toBeDefined()
      expect(includedInAnotherNamespaceObjFilter).toEqual(includedInAnotherNamespaceObj)

      const includedObjectFilter = elements
        .filter(e => e.annotations[API_NAME] === includeObjectName)[0]
      expect(includedObjectFilter).toBeDefined()
      expect(includedObjectFilter).toEqual(includedObject)

      const excludedObjectFilter = elements
        .filter(e => e.annotations[API_NAME] === excludeObjectName)[0]
      expect(excludedObjectFilter).toBeDefined()
      expect(excludedObjectFilter).toEqual(excludedObject)

      const excludeOverrideObjectFilter = elements
        .filter(e => e.annotations[API_NAME] === excludeOverrideObjectName)[0]
      expect(excludeOverrideObjectFilter).toBeDefined()
      expect(excludeOverrideObjectFilter).toEqual(excludeOverrideObject)
    })
  })

  describe('When some CustomObjects are from the namespace', () => {
    let elements: Element[]
    const simpleName = `${testNamespace}__simple__c`
    const simpleObject = createCustomObject(simpleName)

    const withNameName = `${testNamespace}__withCompoundName__c`
    const objWithNameField = createCustomObject(withNameName)
    objWithNameField.fields.Name.type = Types.compoundDataTypes.Name

    const withAddressName = `${testNamespace}__withAddress__c`
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
    const expectedFirstInstanceName = `${NAME_FROM_GET_ELEM_ID}${TestCustomRecords[0].Id}`

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
          [SALESFORCE, INSTALLED_PACKAGES_PATH, testNamespace, OBJECTS_PATH,
            simpleName, RECORDS_PATH, expectedFirstInstanceName]
        )
      })

      it('should create the instances with ElemID name according to the getElemID func', () => {
        expect(instances[0].elemID.name).toEqual(expectedFirstInstanceName)
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
          [SALESFORCE, INSTALLED_PACKAGES_PATH, testNamespace, OBJECTS_PATH,
            withNameName, RECORDS_PATH, expectedFirstInstanceName]
        )
      })

      it('should create the instances with ElemID name according to the getElemID func', () => {
        expect(instances[0].elemID.name).toEqual(expectedFirstInstanceName)
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
          [SALESFORCE, INSTALLED_PACKAGES_PATH, testNamespace, OBJECTS_PATH,
            withAddressName, RECORDS_PATH, expectedFirstInstanceName]
        )
      })

      it('should create the instances with ElemID name according to the getElemID func', () => {
        expect(instances[0].elemID.name).toEqual(expectedFirstInstanceName)
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

  describe('referenceTo fetching logic', () => {
    let elements: Element[]

    const refToObject = createCustomObject(refToObjectName)
    const refToFromNamespaceObject = createCustomObject(refToFromNamespaceObjectName)
    const emptyRefToObject = createCustomObject(emptyRefToObjectName)

    const refFromAndToObject = createCustomObject(
      refFromAndToObjectName,
      {
        Parent: {
          type: Types.primitiveDataTypes.MasterDetail,
          annotations: {
            [LABEL]: 'parent field',
            [API_NAME]: 'Parent',
            [FIELD_ANNOTATIONS.REFERENCE_TO]: [refToObjectName],
          },
        },
        Pricebook2Id: {
          type: Types.primitiveDataTypes.Lookup,
          annotations: {
            [LABEL]: 'Pricebook2Id field',
            [API_NAME]: 'Pricebook2Id',
            [FIELD_ANNOTATIONS.REFERENCE_TO]: [refToFromNamespaceObjectName],
          },
        },
      }
    )

    const namespacedRefFromName = `${refFromNamespace}___refFrom__c`
    const namespacedRefFromObject = createCustomObject(
      namespacedRefFromName,
      {
        Parent: {
          type: Types.primitiveDataTypes.MasterDetail,
          annotations: {
            [LABEL]: 'parent field',
            [API_NAME]: 'Parent',
            [FIELD_ANNOTATIONS.REFERENCE_TO]: [refFromAndToObjectName],
          },
        },
        Pricebook2Id: {
          type: Types.primitiveDataTypes.Lookup,
          annotations: {
            [LABEL]: 'Pricebook2Id field',
            [API_NAME]: 'Pricebook2Id',
            [FIELD_ANNOTATIONS.REFERENCE_TO]: [refToObjectName],
          },
        },
      }
    )

    beforeEach(async () => {
      elements = [
        refToObject, refToFromNamespaceObject, refFromAndToObject,
        namespacedRefFromObject, emptyRefToObject,
      ]
      await filter.onFetch(elements)
    })

    it('should add instances per configured object', () => {
      // 5 object + 2 new instances per needed instances (all by empty ref)
      expect(elements.length).toEqual(13)
      expect(elements.filter(e => isInstanceElement(e)).length).toEqual(8)
    })

    it('should query refTo by ids according to references values', () => {
      expect(basicQueryImplementation).toHaveBeenCalledWith(`SELECT Name,TestField FROM ${refToObjectName} WHERE Id IN ('hijklmn','badId','abcdefg')`)
    })

    it('should qeuery all namespaced/included objects not by id', () => {
      expect(basicQueryImplementation).toHaveBeenCalledWith(`SELECT Name,TestField FROM ${refToFromNamespaceObjectName}`)
      expect(basicQueryImplementation).toHaveBeenCalledWith(`SELECT Name,TestField,Parent,Pricebook2Id FROM ${namespacedRefFromName}`)
      expect(basicQueryImplementation).toHaveBeenCalledWith(`SELECT Name,TestField,Parent,Pricebook2Id FROM ${refFromAndToObjectName}`)
    })
  })

  describe('When some CustomObjects are from the nameBasedID namespace', () => {
    let elements: Element[]

    const refToObject = createCustomObject(refToObjectName)
    const refFromObjectName = `${nameBasedNamespace}__refFrom__c`
    const refFromObject = createCustomObject(
      refFromObjectName,
      {
        Parent: {
          type: Types.primitiveDataTypes.MasterDetail,
          annotations: {
            [LABEL]: 'master field',
            [API_NAME]: 'MasterField',
            [FIELD_ANNOTATIONS.REFERENCE_TO]: [refToObjectName],
          },
        },
      }
    )

    const grandparentObjectName = `${nameBasedNamespace}__grandparent__c`
    const grandparentObject = createCustomObject(grandparentObjectName)

    const parentObjectName = `${nameBasedNamespace}__parent__c`
    const parentObject = createCustomObject(
      parentObjectName,
      {
        Grandparent: {
          type: Types.primitiveDataTypes.MasterDetail,
          annotations: {
            [LABEL]: 'master field',
            [API_NAME]: 'MasterField',
            [FIELD_ANNOTATIONS.REFERENCE_TO]: [grandparentObjectName],
          },
        },
      }
    )

    const pricebookEntryName = 'PricebookEntry'
    const pricebookEntryObject = createCustomObject(
      pricebookEntryName,
      {
        Pricebook2Id: {
          type: Types.primitiveDataTypes.Lookup,
          annotations: {
            [LABEL]: 'Pricebook2Id field',
            [API_NAME]: 'Pricebook2Id',
            [FIELD_ANNOTATIONS.REFERENCE_TO]: [grandparentObjectName],
          },
        },
      }
    )

    const SBQQCustomActionName = 'SBQQ__CustomAction__c'
    const SBQQCustomActionObject = createCustomObject(
      SBQQCustomActionName,
      {
        SBQQ__Location__c: {
          type: Types.primitiveDataTypes.Checkbox,
          annotations: {
            [LABEL]: 'Location checkbox field',
            [API_NAME]: 'SBQQ__Location__c',
            [FIELD_ANNOTATIONS.VALUE_SET]: [
              {
                fullName: 'Quote',
                default: true,
                label: 'Quote',
              },
            ],
          },
        },
        SBQQ__DisplayOrder__c: {
          type: Types.primitiveDataTypes.Number,
          annotations: {
            [LABEL]: 'Display order',
            [API_NAME]: 'SBQQ__DisplayOrder__c',
          },
        },
      }
    )

    const grandsonObjectName = `${nameBasedNamespace}__grandson__c`
    const grandsonObject = createCustomObject(
      grandsonObjectName,
      {
        Parent: {
          type: Types.primitiveDataTypes.MasterDetail,
          annotations: {
            [LABEL]: 'master field',
            [API_NAME]: 'MasterField',
            [FIELD_ANNOTATIONS.REFERENCE_TO]: [parentObjectName],
          },
        },
      }
    )

    const orphanObjectName = `${nameBasedNamespace}__orphan__c`
    const orphanObject = createCustomObject(
      orphanObjectName,
      {
        Parent: {
          type: Types.primitiveDataTypes.MasterDetail,
          annotations: {
            [LABEL]: 'master field',
            [API_NAME]: 'MasterField',
            [FIELD_ANNOTATIONS.REFERENCE_TO]: ['noSuchObject'],
          },
        },
      }
    )

    beforeEach(async () => {
      elements = [
        grandparentObject, parentObject, grandsonObject, orphanObject,
        pricebookEntryObject, SBQQCustomActionObject, refFromObject, refToObject,
      ]
      await filter.onFetch(elements)
    })

    it('should add instances per configured object', () => {
      // 2 new instances per configured object because of TestCustomRecords's length
      expect(elements.length).toEqual(24)
      expect(elements.filter(e => isInstanceElement(e)).length).toEqual(16)
    })

    describe('grandparent object (no master)', () => {
      let instances: InstanceElement[]
      beforeEach(() => {
        instances = elements.filter(
          e => isInstanceElement(e) && e.type === grandparentObject
        ) as InstanceElement[]
      })

      it('should base elemID on record name only', () => {
        expect(instances[0].elemID.name).toEqual(`${NAME_FROM_GET_ELEM_ID}${TestCustomRecords[0].Name}`)
      })
    })

    describe('parent object (master is grandparent)', () => {
      let instances: InstanceElement[]
      beforeEach(() => {
        instances = elements.filter(
          e => isInstanceElement(e) && e.type === parentObject
        ) as InstanceElement[]
      })

      it('should base elemID on grandparentName + parent', () => {
        const grandparentName = TestCustomRecords[1].Name
        const parentName = TestCustomRecords[0].Name
        expect(instances[0].elemID.name).toEqual(`${NAME_FROM_GET_ELEM_ID}${grandparentName}___${parentName}`)
      })
    })

    describe('grandson object (master is parent who has grandparent as master)', () => {
      let instances: InstanceElement[]
      beforeEach(() => {
        instances = elements.filter(
          e => isInstanceElement(e) && e.type === grandsonObject
        ) as InstanceElement[]
      })

      it('should base elemID on grandparentName + parent + grandson if all exist', () => {
        const grandparentName = TestCustomRecords[0].Name
        const parentName = TestCustomRecords[1].Name
        const grandsonName = TestCustomRecords[0].Name
        expect(instances[0].elemID.name).toEqual(`${NAME_FROM_GET_ELEM_ID}${grandparentName}___${parentName}___${grandsonName}`)
      })

      it('should base elemID on grandon name only if no record with references parent id', () => {
        expect(instances[1].elemID.name).toEqual(`${NAME_FROM_GET_ELEM_ID}${TestCustomRecords[1].Name}`)
      })
    })

    describe('orphan object (master non-existance)', () => {
      let instances: InstanceElement[]
      beforeEach(() => {
        instances = elements.filter(
          e => isInstanceElement(e) && e.type === orphanObject
        ) as InstanceElement[]
      })

      it('should base elemID on record name only', () => {
        expect(instances[0].elemID.name).toEqual(`${NAME_FROM_GET_ELEM_ID}${TestCustomRecords[0].Name}`)
      })
    })

    describe('ref from object (with master that is defined as ref to and not "base" object)', () => {
      let instances: InstanceElement[]
      beforeEach(() => {
        instances = elements.filter(
          e => isInstanceElement(e) && e.type === refFromObject
        ) as InstanceElement[]
      })

      it('should base elemID on refTo name as "parent" and refFrom as "child"', () => {
        const refToName = TestCustomRecords[1].Name
        const refFromName = TestCustomRecords[0].Name
        expect(instances[0].elemID.name).toEqual(`${NAME_FROM_GET_ELEM_ID}${refToName}___${refFromName}`)
      })
    })

    describe('ref to object (not base object, only fetched cause of ref to it)', () => {
      let instances: InstanceElement[]
      beforeEach(() => {
        instances = elements.filter(
          e => isInstanceElement(e) && e.type === refToObject
        ) as InstanceElement[]
      })

      it('should base elemID on record name', () => {
        expect(instances[0].elemID.name).toEqual(`${NAME_FROM_GET_ELEM_ID}${TestCustomRecords[0].Name}`)
      })
    })

    describe('PricebookEntry object (special case - Lookup)', () => {
      let instances: InstanceElement[]
      beforeEach(() => {
        instances = elements.filter(
          e => isInstanceElement(e) && e.type === pricebookEntryObject
        ) as InstanceElement[]
      })

      it('should base elemID on Pricebook2Id lookup name + the entry', () => {
        const pricebookLookupName = TestCustomRecords[1].Name
        const pricebookEntry = TestCustomRecords[0].Name
        expect(instances[0].elemID.name).toEqual(`${NAME_FROM_GET_ELEM_ID}${pricebookLookupName}___${pricebookEntry}`)
      })
    })

    describe('SBQQ__CustomAction__c object (special case - base on record values besides name)', () => {
      let instances: InstanceElement[]
      beforeEach(() => {
        instances = elements.filter(
          e => isInstanceElement(e) && e.type === SBQQCustomActionObject
        ) as InstanceElement[]
      })

      it('should base elemID on Name + displayOrder + location', () => {
        const recordName = TestCustomRecords[0].Name
        const recordLocation = TestCustomRecords[0].SBQQ__Location__c
        const recordDisplayOrder = TestCustomRecords[0].SBQQ__DisplayOrder__c
        expect(instances[0].elemID.name).toEqual(`${NAME_FROM_GET_ELEM_ID}${recordLocation}___${recordDisplayOrder}___${recordName}`)
      })
    })
  })

  afterEach(() => {
    jest.resetAllMocks()
  })
})
