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
import _ from 'lodash'
import {
  BuiltinTypes,
  CORE_ANNOTATIONS,
  createRefToElmWithValue,
  Element,
  ElemID,
  FieldDefinition,
  InstanceElement,
  isInstanceElement,
  ObjectType,
  PrimitiveType,
  PrimitiveTypes,
  ServiceIds,
} from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import { ConfigChangeSuggestion, isDataManagementConfigSuggestions } from '../../src/types'
import { getNamespaceFromString, buildSelectQueries, getFieldNamesForQuery } from '../../src/filters/utils'
import { FilterResult, FilterWith } from '../../src/filter'
import SalesforceClient from '../../src/client/client'
import Connection from '../../src/client/jsforce'
import filterCreator from '../../src/filters/custom_objects_instances'
import mockAdapter from '../adapter'
import {
  API_NAME,
  CUSTOM_OBJECT,
  FIELD_ANNOTATIONS,
  INSTALLED_PACKAGES_PATH,
  LABEL,
  METADATA_TYPE,
  OBJECTS_PATH,
  RECORDS_PATH,
  SALESFORCE,
} from '../../src/constants'
import { Types } from '../../src/transformers/transformer'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import { defaultFilterContext } from '../utils'

const { awu } = collections.asynciterable

jest.mock('../../src/constants', () => ({
  ...jest.requireActual<{}>('../../src/constants'),
  MAX_IDS_PER_INSTANCES_QUERY: 2,
}))

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
    Id: {
      refType: stringType,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: false,
        [FIELD_ANNOTATIONS.QUERYABLE]: true,
        [LABEL]: 'Id',
        [API_NAME]: 'Id',
      },
    },
    Name: {
      refType: stringType,
      annotations: {
        [CORE_ANNOTATIONS.REQUIRED]: false,
        [FIELD_ANNOTATIONS.QUERYABLE]: true,
        [LABEL]: 'description label',
        [API_NAME]: 'Name',
      },
    },
    TestField: {
      refType: stringType,
      annotations: {
        [FIELD_ANNOTATIONS.QUERYABLE]: true,
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

/* eslint-disable camelcase */
describe('Custom Object Instances filter', () => {
  let connection: Connection
  let client: SalesforceClient
  type FilterType = FilterWith<'onFetch'>
  let filter: FilterType

  const createNamespaceRegexFromString = (namespace: string): string =>
    `${namespace}__.*`

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
      ProductCode: null,
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
      Parent: 'abcdefg',
      Grandparent: 'abcdefg',
      Pricebook2Id: 'abcdefg',
      SBQQ__Location__c: 'Quote',
      SBQQ__DisplayOrder__c: 3,
    },
  ]

  let basicQueryImplementation: jest.Mock

  const testNamespace = 'TestNamespace'
  const nameBasedNamespace = 'NameBasedNamespace'
  const refFromNamespace = 'RefFromNamespace'
  const includeObjectName = 'IncludeThisObject'
  const excludeObjectName = 'TestNamespace__ExcludeMe__c'
  const excludeOverrideObjectName = 'ExcludeOverrideObject'
  const refToObjectName = 'RefTo'
  const refToFromNamespaceObjectName = 'RefFromNamespace__RefTo__c'
  const refFromAndToObjectName = 'RefFromAndTo'
  const emptyRefToObjectName = 'EmptyRefTo'
  const notInNamespaceName = 'NotInNamespace__c'

  beforeEach(async () => {
    ({ connection, client } = mockAdapter({
      adapterParams: {
        getElemIdFunc: mockGetElemIdFunc,
      },
    }))
    basicQueryImplementation = jest.fn().mockImplementation(async () => (
      {
        totalSize: 2,
        done: true,
        records: TestCustomRecords,
      }))
    connection.query = basicQueryImplementation
  })

  describe('Without includeObjects', () => {
    const excludeObject = createCustomObject(excludeObjectName)
    const refToObject = createCustomObject(refToObjectName)
    let elements: Element[]
    beforeEach(async () => {
      filter = filterCreator(
        {
          client,
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              data: {
                includeObjects: [
                ],
                excludeObjects: [
                  '^TestNamespace__Exclude.*',
                  excludeOverrideObjectName,
                ],
                allowReferenceTo: [
                  '^RefFromNamespace__RefTo.*',
                  refToObjectName,
                  refFromAndToObjectName,
                  emptyRefToObjectName,
                ],
                saltoIDSettings: {
                  defaultIdFields: [],
                },
              },
            }),
          },
        }
      ) as FilterType
    })

    beforeEach(async () => {
      elements = [
        excludeObject, refToObject,
      ]
      await filter.onFetch(elements)
    })

    it('should not add any more elements', () => {
      expect(elements).toHaveLength(2)
    })

    it('should not effect the types', async () => {
      const excludedAfterFilter = elements
        .filter(e => e.annotations[API_NAME] === excludeObjectName)[0]
      expect(excludedAfterFilter).toBeDefined()
      expect(excludedAfterFilter).toEqual(excludeObject)

      const refToAfterFilter = elements
        .filter(e => e.annotations[API_NAME] === refToObjectName)[0]
      expect(refToAfterFilter).toBeDefined()
      expect(refToAfterFilter).toEqual(refToObject)
    })
  })

  describe('Without nameBasedID', () => {
    beforeEach(async () => {
      filter = filterCreator(
        {
          client,
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              data: {
                includeObjects: [
                  createNamespaceRegexFromString(testNamespace),
                  createNamespaceRegexFromString(refFromNamespace),
                  includeObjectName,
                  excludeOverrideObjectName,
                  refFromAndToObjectName,
                  notInNamespaceName,
                ],
                excludeObjects: [
                  '^TestNamespace__Exclude.*',
                  excludeOverrideObjectName,
                ],
                allowReferenceTo: [
                  '^RefFromNamespace__RefTo.*',
                  refToObjectName,
                  refFromAndToObjectName,
                  emptyRefToObjectName,
                ],
                saltoIDSettings: {
                  defaultIdFields: ['Id'],
                },
              },
            }),
          },
        }
      ) as FilterType
    })

    describe('Config filtering logic', () => {
      let elements: Element[]
      const notConfiguredObjName = 'NotInNameSpace'
      const notConfiguredObj = createCustomObject(notConfiguredObjName)

      const includedNamespaceObjName = `${testNamespace}__Included__c`
      const includedNameSpaceObj = createCustomObject(includedNamespaceObjName)

      const includedObject = createCustomObject(includeObjectName)
      const excludedObject = createCustomObject(excludeObjectName)
      const excludeOverrideObject = createCustomObject(excludeOverrideObjectName)
      beforeEach(async () => {
        elements = [
          notConfiguredObj, includedNameSpaceObj,
          includedObject, excludedObject, excludeOverrideObject,
        ]
        await filter.onFetch(elements)
      })

      describe('should add instances per configured object', () => {
        it('should not fetch for non-configured objects', async () => {
          const notConfiguredObjInstances = await awu(elements).filter(
            async e => isInstanceElement(e) && await e.getType() === notConfiguredObj
          ).toArray() as InstanceElement[]
          expect(notConfiguredObjInstances.length).toEqual(0)
        })

        it('should fetch for regex configured objects', async () => {
          const includedNameSpaceObjInstances = await awu(elements).filter(
            async e => isInstanceElement(e) && await e.getType() === includedNameSpaceObj
          ).toArray() as InstanceElement[]
          expect(includedNameSpaceObjInstances.length).toEqual(2)
        })

        it('should fetch for object included specifically configured', async () => {
          const includedObjectInstances = await awu(elements).filter(
            async e => isInstanceElement(e) && await e.getType() === includedObject
          ).toArray() as InstanceElement[]
          expect(includedObjectInstances.length).toEqual(2)
        })

        it('should not fetch for object from a configured regex whose excluded specifically', async () => {
          const excludedObjectInstances = await awu(elements).filter(
            async e => isInstanceElement(e) && await e.getType() === excludedObject
          ).toArray() as InstanceElement[]
          expect(excludedObjectInstances.length).toEqual(0)
        })

        it('should not fetch for object from a configured as excluded even if it was included by object', async () => {
          const excludeOverrideObjectInstances = await awu(elements).filter(
            async e => isInstanceElement(e) && await e.getType() === excludeOverrideObject
          ).toArray() as InstanceElement[]
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

    describe('When some CustomObjects fit the configured regex (namespace)', () => {
      let elements: Element[]
      const simpleName = `${testNamespace}__simple__c`
      const simpleObject = createCustomObject(simpleName)

      const noFieldsName = `${testNamespace}__noQueryablefields`
      const objWithNoFields = new ObjectType({
        elemID: new ElemID(SALESFORCE, noFieldsName),
        fields: {
          Id: {
            refType: stringType,
            annotations: {
              [API_NAME]: 'Id',
              [FIELD_ANNOTATIONS.QUERYABLE]: false,
            },
          },
          Other: {
            refType: stringType,
            annotations: {
              [FIELD_ANNOTATIONS.QUERYABLE]: true,
              [API_NAME]: 'Other',
            },
          },
        },
        annotations: {
          [FIELD_ANNOTATIONS.QUERYABLE]: true,
          [API_NAME]: noFieldsName,
          [METADATA_TYPE]: CUSTOM_OBJECT,
        },
      })

      const withNameName = `${testNamespace}__withCompoundName__c`
      const objWithNameField = createCustomObject(withNameName)
      objWithNameField.fields.Name.refType = createRefToElmWithValue(Types.compoundDataTypes.Name)

      const withAddressName = `${testNamespace}__withAddress__c`
      const objWithAddressField = createCustomObject(withAddressName, {
        OtherAddress: {
          refType: Types.compoundDataTypes.Address,
          annotations: {
            [FIELD_ANNOTATIONS.QUERYABLE]: true,
            [LABEL]: 'Address',
            [API_NAME]: 'OtherAddress',
          },
        },
      })

      const objNotInNamespace = createCustomObject(notInNamespaceName)
      const expectedFirstInstanceName = `${NAME_FROM_GET_ELEM_ID}${TestCustomRecords[0].Id}`

      beforeEach(async () => {
        elements = [
          simpleObject, objWithNoFields, objWithNameField, objWithAddressField, objNotInNamespace,
        ]
        await filter.onFetch(elements)
      })

      it('should add instances per catched by regex object with fields', async () => {
        // 2 new instances per namespaced object because of TestCustomRecords's length
        expect(elements.length).toEqual(13)
        expect((await awu(elements).filter(e => isInstanceElement(e)).toArray()).length).toEqual(8)
      })


      describe('simple object', () => {
        let instances: InstanceElement[]
        beforeEach(async () => {
          instances = await awu(elements).filter(
            async e => isInstanceElement(e) && await e.getType() === simpleObject
          ).toArray() as InstanceElement[]
        })


        it('should call query with the object fields', () => {
          expect(basicQueryImplementation).toHaveBeenCalledWith(`SELECT Id,Name,TestField FROM ${simpleName}`)
        })

        it('should create instances according to results', () => {
          expect(instances.length).toEqual(2)
        })
        it('should create the instances with record path according to object', () => {
          expect(instances[0].path).toEqual(
            [SALESFORCE, INSTALLED_PACKAGES_PATH, testNamespace,
              RECORDS_PATH, simpleName, expectedFirstInstanceName]
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

        it('should omit attributes from the value', () => {
          const { value } = instances[0]
          expect(value.attributes).toBeUndefined()
        })
      })

      describe('object with no queryable fields', () => {
        let instances: InstanceElement[]
        beforeEach(async () => {
          instances = await awu(elements).filter(
            async e => isInstanceElement(e) && await e.getType() === objWithNoFields
          ).toArray() as InstanceElement[]
        })

        it('should not try to query for object', () => {
          expect(basicQueryImplementation).not.toHaveBeenCalledWith(expect.stringMatching(/.*noQueryablefields.*/))
        })

        it('should not create any instances', () => {
          expect(instances.length).toEqual(0)
        })
      })

      describe('not in namespace object', () => {
        let instances: InstanceElement[]
        beforeEach(async () => {
          instances = await awu(elements).filter(
            async e => isInstanceElement(e) && await e.getType() === objNotInNamespace
          ).toArray() as InstanceElement[]
        })
        it('should create instances according to results', () => {
          expect(instances.length).toEqual(2)
        })
        it('should create the instances with record path according to object', () => {
          expect(instances[0].path).toEqual(
            [SALESFORCE, RECORDS_PATH, notInNamespaceName, expectedFirstInstanceName]
          )
        })
      })

      describe('object with compound Name', () => {
        let instances: InstanceElement[]
        beforeEach(async () => {
          instances = await awu(elements).filter(
            async e => isInstanceElement(e) && await e.getType() === objWithNameField
          ).toArray() as InstanceElement[]
        })

        it('should call query with the object fields', () => {
          expect(basicQueryImplementation).toHaveBeenCalledWith(`SELECT Id,FirstName,LastName,Salutation,MiddleName,Suffix,TestField FROM ${withNameName}`)
        })

        it('should create instances according to results', () => {
          expect(instances.length).toEqual(2)
        })
        it('should create the instances with record path according to object', () => {
          expect(instances[0].path).toEqual(
            [SALESFORCE, INSTALLED_PACKAGES_PATH, testNamespace,
              RECORDS_PATH, withNameName, expectedFirstInstanceName]
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

        it('should omit attributes from the value', () => {
          const { value } = instances[0]
          expect(value.attributes).toBeUndefined()
        })
      })

      describe('object with compound Address', () => {
        let instances: InstanceElement[]
        beforeEach(async () => {
          instances = await awu(elements).filter(
            async e => isInstanceElement(e) && await e.getType() === objWithAddressField
          ).toArray() as InstanceElement[]
        })

        it('should call query with the object fields', () => {
          expect(basicQueryImplementation).toHaveBeenCalledWith(`SELECT Id,Name,TestField,OtherAddress FROM ${withAddressName}`)
        })

        it('should create instances according to results', () => {
          expect(instances.length).toEqual(2)
        })
        it('should create the instances with record path according to object', () => {
          expect(instances[0].path).toEqual(
            [SALESFORCE, INSTALLED_PACKAGES_PATH, testNamespace,
              RECORDS_PATH, withAddressName, expectedFirstInstanceName]
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

        it('should omit attributes from the value', () => {
          const { value } = instances[0]
          expect(value.attributes).toBeUndefined()
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
            refType: Types.primitiveDataTypes.MasterDetail,
            annotations: {
              [LABEL]: 'parent field',
              [API_NAME]: 'Parent',
              [FIELD_ANNOTATIONS.REFERENCE_TO]: [refToObjectName],
              [FIELD_ANNOTATIONS.QUERYABLE]: true,
            },
          },
          Pricebook2Id: {
            refType: Types.primitiveDataTypes.Lookup,
            annotations: {
              [LABEL]: 'Pricebook2Id field',
              [API_NAME]: 'Pricebook2Id',
              [FIELD_ANNOTATIONS.REFERENCE_TO]: [refToFromNamespaceObjectName],
              [FIELD_ANNOTATIONS.QUERYABLE]: true,
            },
          },
        }
      )

      const namespacedRefFromName = `${refFromNamespace}___refFrom__c`
      const namespacedRefFromObject = createCustomObject(
        namespacedRefFromName,
        {
          Parent: {
            refType: Types.primitiveDataTypes.MasterDetail,
            annotations: {
              [LABEL]: 'parent field',
              [API_NAME]: 'Parent',
              [FIELD_ANNOTATIONS.REFERENCE_TO]: [refFromAndToObjectName],
              [FIELD_ANNOTATIONS.QUERYABLE]: true,
            },
          },
          Pricebook2Id: {
            refType: Types.primitiveDataTypes.Lookup,
            annotations: {
              [LABEL]: 'Pricebook2Id field',
              [API_NAME]: 'Pricebook2Id',
              [FIELD_ANNOTATIONS.REFERENCE_TO]: [refToObjectName],
              [FIELD_ANNOTATIONS.QUERYABLE]: true,
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

      it('should add instances per configured object', async () => {
        // 5 object + 2 new instances per needed instances (all by empty ref)
        expect(elements.length).toEqual(13)
        expect((await awu(elements).filter(e => isInstanceElement(e)).toArray()).length).toEqual(8)
      })

      it('should query refTo by ids according to references values', () => {
        // The query should be split according to MAX_IDS_PER_INSTANCES_QUERY
        expect(basicQueryImplementation).toHaveBeenCalledWith(`SELECT Id,Name,TestField FROM ${refToObjectName} WHERE Id IN ('hijklmn','abcdefg')`)
      })

      it('should query all namespaced/included objects not by id', () => {
        expect(basicQueryImplementation).toHaveBeenCalledWith(`SELECT Id,Name,TestField FROM ${refToFromNamespaceObjectName}`)
        expect(basicQueryImplementation).toHaveBeenCalledWith(`SELECT Id,Name,TestField,Parent,Pricebook2Id FROM ${namespacedRefFromName}`)
        expect(basicQueryImplementation).toHaveBeenCalledWith(`SELECT Id,Name,TestField,Parent,Pricebook2Id FROM ${refFromAndToObjectName}`)
      })
    })

    afterEach(() => {
      jest.resetAllMocks()
    })
  })

  describe('When configured with default autoDetectParentFields + name', () => {
    let elements: Element[]

    const refToObject = createCustomObject(refToObjectName)
    const refFromObjectName = `${nameBasedNamespace}__refFrom__c`
    const refFromObject = createCustomObject(
      refFromObjectName,
      {
        Parent: {
          refType: Types.primitiveDataTypes.MasterDetail,
          annotations: {
            [FIELD_ANNOTATIONS.QUERYABLE]: true,
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
          refType: Types.primitiveDataTypes.MasterDetail,
          annotations: {
            [FIELD_ANNOTATIONS.QUERYABLE]: true,
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
          refType: Types.primitiveDataTypes.Lookup,
          annotations: {
            [FIELD_ANNOTATIONS.QUERYABLE]: true,
            [LABEL]: 'Pricebook2Id field',
            [API_NAME]: 'Pricebook2Id',
            [FIELD_ANNOTATIONS.REFERENCE_TO]: [grandparentObjectName],
          },
        },
      }
    )

    const productName = 'Product2'
    const productObject = createCustomObject(
      productName,
      {
        ProductCode: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [FIELD_ANNOTATIONS.QUERYABLE]: true,
            [LABEL]: 'ProductCode field',
            [API_NAME]: 'ProductCode',
          },
        },
      }
    )

    const SBQQCustomActionName = 'SBQQ__CustomAction__c'
    const SBQQCustomActionObject = createCustomObject(
      SBQQCustomActionName,
      {
        SBQQ__Location__c: {
          refType: Types.primitiveDataTypes.Checkbox,
          annotations: {
            [FIELD_ANNOTATIONS.QUERYABLE]: true,
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
          refType: Types.primitiveDataTypes.Number,
          annotations: {
            [FIELD_ANNOTATIONS.QUERYABLE]: true,
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
          refType: Types.primitiveDataTypes.MasterDetail,
          annotations: {
            [FIELD_ANNOTATIONS.QUERYABLE]: true,
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
          refType: Types.primitiveDataTypes.MasterDetail,
          annotations: {
            [FIELD_ANNOTATIONS.QUERYABLE]: true,
            [LABEL]: 'master field',
            [API_NAME]: 'MasterField',
            [FIELD_ANNOTATIONS.REFERENCE_TO]: ['noSuchObject'],
          },
        },
      }
    )

    const badIdFieldsName = 'BadIdFields'
    const badIdFieldsObject = createCustomObject(badIdFieldsName)

    const notQueryableIdFieldsName = 'notQueryableIdFields'
    const notQueryableIdFieldsObject = createCustomObject(
      notQueryableIdFieldsName,
      {
        NotQueryable: {
          refType: BuiltinTypes.STRING,
          annotations: {
            [LABEL]: 'not queryable',
            [API_NAME]: 'NotQueryable',
            [FIELD_ANNOTATIONS.QUERYABLE]: false,
          },
        },
      }
    )

    let changeSuggestions: ConfigChangeSuggestion[]
    beforeEach(async () => {
      filter = filterCreator(
        {
          client,
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              data: {
                includeObjects: [
                  createNamespaceRegexFromString(nameBasedNamespace),
                  pricebookEntryName,
                  SBQQCustomActionName,
                  productName,
                  badIdFieldsName,
                  notQueryableIdFieldsName,
                ],
                allowReferenceTo: [
                  refToObjectName,
                ],
                saltoIDSettings: {
                  defaultIdFields: ['##allMasterDetailFields##', 'Name'],
                  overrides: [
                    { objectsRegex: pricebookEntryName, idFields: ['Pricebook2Id', 'Name'] },
                    { objectsRegex: SBQQCustomActionName, idFields: ['SBQQ__Location__c', 'SBQQ__DisplayOrder__c', 'Name'] },
                    { objectsRegex: badIdFieldsName, idFields: ['Bad'] },
                    { objectsRegex: productName, idFields: ['ProductCode', 'Name'] },
                    { objectsRegex: notQueryableIdFieldsName, idFields: ['NotQueryable'] },
                  ],
                },
              },
            }),
          },
        }
      ) as FilterType
      elements = [
        grandparentObject, parentObject, grandsonObject, orphanObject, productObject,
        pricebookEntryObject, SBQQCustomActionObject, refFromObject, refToObject,
        badIdFieldsObject, notQueryableIdFieldsObject,
      ]
      changeSuggestions = (((await filter.onFetch(elements))
        ?? { configSuggestions: [], errors: [] }) as FilterResult).configSuggestions ?? []
    })

    it('should add instances per configured object', async () => {
      // 2 new instances per configured object because of TestCustomRecords's length
      expect(elements.length).toEqual(27)
      expect((await awu(elements).filter(
        e => isInstanceElement(e)
      ).toArray()).length).toEqual(16)
    })

    describe('grandparent object (no master)', () => {
      let instances: InstanceElement[]
      beforeEach(async () => {
        instances = await awu(elements).filter(
          async e => isInstanceElement(e) && await e.getType() === grandparentObject
        ).toArray() as InstanceElement[]
      })

      it('should base elemID on record name only', () => {
        expect(instances[0].elemID.name).toEqual(`${NAME_FROM_GET_ELEM_ID}${TestCustomRecords[0].Name}`)
      })
    })

    describe('parent object (master is grandparent)', () => {
      let instances: InstanceElement[]
      beforeEach(async () => {
        instances = await awu(elements).filter(
          async e => isInstanceElement(e) && await e.getType() === parentObject
        ).toArray() as InstanceElement[]
      })

      it('should base elemID on grandparentName + parent', () => {
        const grandparentName = TestCustomRecords[1].Name
        const parentName = TestCustomRecords[0].Name
        expect(instances[0].elemID.name).toEqual(`${NAME_FROM_GET_ELEM_ID}${grandparentName}___${parentName}`)
      })
    })

    describe('grandson object (master is parent who has grandparent as master)', () => {
      let instances: InstanceElement[]
      beforeEach(async () => {
        instances = await awu(elements).filter(
          async e => isInstanceElement(e) && await e.getType() === grandsonObject
        ).toArray() as InstanceElement[]
      })

      it('should base elemID on grandparentName + parent + grandson if all exist', () => {
        const grandparentName = TestCustomRecords[0].Name
        const parentName = TestCustomRecords[1].Name
        const grandsonName = TestCustomRecords[0].Name
        expect(instances[0].elemID.name).toEqual(`${NAME_FROM_GET_ELEM_ID}${grandparentName}___${parentName}___${grandsonName}`)
      })
    })

    describe('orphan object (master non-existance)', () => {
      let instances: InstanceElement[]
      beforeEach(async () => {
        instances = await awu(elements).filter(
          async e => isInstanceElement(e) && await e.getType() === orphanObject
        ).toArray() as InstanceElement[]
      })
      it('should not create instances and suggest to add to include list', () => {
        expect(instances).toHaveLength(0)
        const changeSuggestionWithOrphanValue = changeSuggestions
          .filter(isDataManagementConfigSuggestions)
          .filter(suggestion => suggestion.value.includes(orphanObjectName))
        expect(changeSuggestionWithOrphanValue).toHaveLength(1)
        expect(changeSuggestionWithOrphanValue[0].type).toEqual('dataObjectsExclude')
        expect(changeSuggestionWithOrphanValue[0].reason).toEqual(`${orphanObjectName} has Parent (reference) configured as idField. Failed to resolve some of the references.`)
      })
    })

    describe('badIdFields object', () => {
      let instances: InstanceElement[]
      beforeEach(async () => {
        instances = await awu(elements).filter(
          async e => isInstanceElement(e) && await e.getType() === badIdFieldsObject
        ).toArray() as InstanceElement[]
      })

      it('should not create instances and suggest to add to include list', () => {
        expect(instances).toHaveLength(0)
        const changeSuggestionWithBadFieldsValue = changeSuggestions
          .filter(isDataManagementConfigSuggestions)
          .filter(suggestion => suggestion.value.includes(badIdFieldsName))
        expect(changeSuggestionWithBadFieldsValue).toHaveLength(1)
        expect(changeSuggestionWithBadFieldsValue[0].type).toEqual('dataObjectsExclude')
        expect(changeSuggestionWithBadFieldsValue[0].reason).toEqual(`Bad defined as idFields but are not queryable or do not exist on type ${badIdFieldsName}`)
      })
    })

    describe('notQueryableIdFields object', () => {
      let instances: InstanceElement[]
      beforeEach(async () => {
        instances = await awu(elements).filter(
          async e => isInstanceElement(e) && await e.getType() === notQueryableIdFieldsObject
        ).toArray() as InstanceElement[]
      })

      it('should not create instances and suggest to add to include list', () => {
        expect(instances).toHaveLength(0)
        const changeSuggestionWithBadFieldsValue = changeSuggestions
          .filter(isDataManagementConfigSuggestions)
          .filter(suggestion => suggestion.value.includes(notQueryableIdFieldsName))
        expect(changeSuggestionWithBadFieldsValue).toHaveLength(1)
        expect(changeSuggestionWithBadFieldsValue[0].type).toEqual('dataObjectsExclude')
        expect(changeSuggestionWithBadFieldsValue[0].reason).toEqual(`NotQueryable defined as idFields but are not queryable or do not exist on type ${notQueryableIdFieldsName}`)
      })
    })

    describe('ref from object (with master that is defined as ref to and not "base" object)', () => {
      let instances: InstanceElement[]
      beforeEach(async () => {
        instances = await awu(elements).filter(
          async e => isInstanceElement(e) && await e.getType() === refFromObject
        ).toArray() as InstanceElement[]
      })

      it('should base elemID on refTo name as "parent" and refFrom as "child"', () => {
        const refToName = TestCustomRecords[1].Name
        const refFromName = TestCustomRecords[0].Name
        expect(instances[0].elemID.name).toEqual(`${NAME_FROM_GET_ELEM_ID}${refToName}___${refFromName}`)
      })
    })

    describe('ref to object (not base object, only fetched cause of ref to it)', () => {
      let instances: InstanceElement[]
      beforeEach(async () => {
        instances = await awu(elements).filter(
          async e => isInstanceElement(e) && await e.getType() === refToObject
        ).toArray() as InstanceElement[]
      })

      it('should base elemID on record name', () => {
        expect(instances[0].elemID.name).toEqual(`${NAME_FROM_GET_ELEM_ID}${TestCustomRecords[0].Name}`)
      })
    })

    describe('PricebookEntry object (special case - Lookup)', () => {
      let instances: InstanceElement[]
      beforeEach(async () => {
        instances = await awu(elements).filter(
          async e => isInstanceElement(e) && await e.getType() === pricebookEntryObject
        ).toArray() as InstanceElement[]
      })

      it('should base elemID on Pricebook2Id lookup name + the entry', () => {
        const pricebookLookupName = TestCustomRecords[1].Name
        const pricebookEntry = TestCustomRecords[0].Name
        expect(instances[0].elemID.name).toEqual(`${NAME_FROM_GET_ELEM_ID}${pricebookLookupName}___${pricebookEntry}`)
      })
    })

    describe('Product2 object - checking case of non-existing values', () => {
      let instances: InstanceElement[]
      beforeEach(async () => {
        instances = await awu(elements).filter(
          async e => isInstanceElement(e) && await e.getType() === productObject
        ).toArray() as InstanceElement[]
      })

      it('should base elemID on name only because value of other field is null', () => {
        const recordName = TestCustomRecords[0].Name
        expect(instances[0].value.ProductCode).toBeNull()
        expect(instances[0].elemID.name).toEqual(`${NAME_FROM_GET_ELEM_ID}${recordName}`)
      })

      it('should base elemID on name only because value of other field is undefined', () => {
        const recordName = TestCustomRecords[1].Name
        expect(instances[1].value.ProductCode).toBeUndefined()
        expect(instances[1].elemID.name).toEqual(`${NAME_FROM_GET_ELEM_ID}${recordName}`)
      })
    })

    describe('SBQQ__CustomAction__c object (special case - base on record values besides name)', () => {
      let instances: InstanceElement[]
      beforeEach(async () => {
        instances = await awu(elements).filter(
          async e => isInstanceElement(e) && await e.getType() === SBQQCustomActionObject
        ).toArray() as InstanceElement[]
      })

      it('should base elemID on Name + displayOrder + location', () => {
        const recordName = TestCustomRecords[0].Name
        const recordLocation = TestCustomRecords[0].SBQQ__Location__c
        const recordDisplayOrder = TestCustomRecords[0].SBQQ__DisplayOrder__c
        expect(instances[0].elemID.name).toEqual(`${NAME_FROM_GET_ELEM_ID}${recordLocation}___${recordDisplayOrder}___${recordName}`)
      })
    })
  })

  describe('Fetching with MaxInstancesPerType', () => {
    const testElement = createCustomObject('testElement')
    beforeEach(() => {
      client.queryAll = jest.fn().mockResolvedValue([{ key: 'value' }])
      filter = filterCreator(
        {
          client,
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              data: {
                includeObjects: [
                  '.*',
                ],
                allowReferenceTo: [],
                saltoIDSettings: {
                  defaultIdFields: [],
                  overrides: [],
                },
              },
              maxInstancesPerType: 2,
            }),
          },
        }
      ) as FilterType
    })
    it('Should not fetch CustomObjects with more instances than MaxInstancesPerType', async () => {
      const elements = [testElement]
      client.countInstances = jest.fn().mockResolvedValue(3)
      const result = await filter.onFetch(elements)
      expect(elements.length).toBe(1)
      expect(result).toMatchObject({
        configSuggestions: [{
          type: 'dataObjectsExclude',
          value: 'testElement',
          reason: "'testElement' has 3 instances so it was skipped and would be excluded from future fetch operations, as maxInstancesPerType is set to 2.\n      If you wish to fetch it anyway, remove it from your app configuration exclude block and increase maxInstancePerType to the desired value (-1 for unlimited).",
        }],
      })
    })
    it('Should fetch CustomObjects with less instances than MaxInstancesPerType', async () => {
      const elements = [testElement]
      client.countInstances = jest.fn().mockResolvedValue(1)
      const result = await filter.onFetch(elements)
      expect(elements.length).toBe(2)
      expect(result).toMatchObject({ configSuggestions: [] })
    })
    it('Mixed CustomObjects with more and less instances than MaxInstancesPerType', async () => {
      const elements = [testElement, testElement]
      client.countInstances = jest.fn().mockResolvedValueOnce(3).mockResolvedValueOnce(1)
      const result = await filter.onFetch(elements)
      expect(elements.length).toBe(2)
      expect(result).toMatchObject({
        configSuggestions: [{
          type: 'dataObjectsExclude',
          value: 'testElement',
          reason: "'testElement' has 3 instances so it was skipped and would be excluded from future fetch operations, as maxInstancesPerType is set to 2.\n      If you wish to fetch it anyway, remove it from your app configuration exclude block and increase maxInstancePerType to the desired value (-1 for unlimited).",
        }],
      })
    })
  })
})

describe('buildSelectQueries', () => {
  let customObject: ObjectType
  beforeEach(() => {
    customObject = createCustomObject('Test')
  })
  describe('without conditions', () => {
    let queries: string[]
    beforeEach(async () => {
      const fieldNames = await awu(Object.values(customObject.fields)).flatMap(getFieldNamesForQuery).toArray()
      queries = await buildSelectQueries('Test', fieldNames)
    })
    it('should create a select query on the specified fields', () => {
      expect(queries).toHaveLength(1)
      expect(queries[0]).toEqual('SELECT Id,Name,TestField FROM Test')
    })
  })
  describe('with conditions', () => {
    describe('with short query', () => {
      let queries: string[]
      beforeEach(async () => {
        const fieldNames = await awu([customObject.fields.Id]).flatMap(getFieldNamesForQuery).toArray()
        queries = await buildSelectQueries(
          'Test',
          fieldNames,
          _.range(0, 2).map(idx => ({ Id: `'id${idx}'`, Name: `'name${idx}'` })),
        )
      })
      it('should create query with WHERE clause', () => {
        expect(queries).toHaveLength(1)
        expect(queries[0]).toEqual("SELECT Id FROM Test WHERE Id IN ('id0','id1') AND Name IN ('name0','name1')")
      })
    })
    describe('with query length limit', () => {
      let queries: string[]
      beforeEach(async () => {
        const fieldNames = await awu([customObject.fields.Id]).flatMap(getFieldNamesForQuery).toArray()
        queries = await buildSelectQueries(
          'Test',
          fieldNames,
          _.range(0, 4).map(idx => ({ Id: `'id${idx}'`, Name: `'name${idx}'` })),
          80,
        )
      })
      it('should create queries that do not exceed query length', () => {
        expect(queries).toHaveLength(2)
        const queryLengths = queries.map(query => query.length)
        expect(_.max(queryLengths)).toBeLessThanOrEqual(80)
        expect(queries[0]).toEqual("SELECT Id FROM Test WHERE Id IN ('id0','id1') AND Name IN ('name0','name1')")
        expect(queries[1]).toEqual("SELECT Id FROM Test WHERE Id IN ('id2','id3') AND Name IN ('name2','name3')")
      })
    })
  })
})
