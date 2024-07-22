/*
 *                      Copyright 2024 Salto Labs Ltd.
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

import { references } from '@salto-io/adapter-components'
import {
  Element,
  ElemID,
  ObjectType,
  PrimitiveTypes,
  PrimitiveType,
  CORE_ANNOTATIONS,
  InstanceElement,
  ReferenceExpression,
  isInstanceElement,
  SaltoError,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import SalesforceClient from '../../src/client/client'
import filterCreator from '../../src/filters/custom_object_instances_references'
import mockClient from '../client'
import {
  SALESFORCE,
  API_NAME,
  CUSTOM_OBJECT,
  METADATA_TYPE,
  LABEL,
  FIELD_ANNOTATIONS,
  CUSTOM_OBJECT_ID_FIELD,
  INTERNAL_ID_FIELD,
  CHANGED_AT_SINGLETON,
} from '../../src/constants'
import { Types } from '../../src/transformers/transformer'
import {
  createCustomObjectType,
  createMetadataTypeElement,
  defaultFilterContext,
  emptyLastChangeDateOfTypesWithNestedInstances,
} from '../utils'
import { mockInstances, mockTypes } from '../mock_elements'
import { FilterWith } from './mocks'
import { FetchProfile, OutgoingReferenceBehavior } from '../../src/types'
import { buildMetadataQueryForFetchWithChangesDetection } from '../../src/fetch_profile/metadata_query'

const { MISSING_REF_PREFIX } = references

describe('Custom Object Instances References filter', () => {
  let client: SalesforceClient
  type FilterType = FilterWith<'onFetch'>
  let filter: FilterType

  const stringType = new PrimitiveType({
    elemID: new ElemID(SALESFORCE, 'string'),
    primitive: PrimitiveTypes.STRING,
  })
  const userObjName = 'User'
  const userElemID = new ElemID(SALESFORCE, userObjName)
  const userObj = new ObjectType({
    elemID: userElemID,
    annotations: {
      [API_NAME]: userObjName,
      [METADATA_TYPE]: CUSTOM_OBJECT,
    },
    fields: {
      Id: {
        refType: stringType,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [LABEL]: 'Id',
          [API_NAME]: 'Id',
        },
      },
    },
  })
  const masterName = 'masterName'
  const masterElemID = new ElemID(SALESFORCE, masterName)
  const masterObj = new ObjectType({
    elemID: masterElemID,
    annotations: {
      [API_NAME]: masterName,
      [METADATA_TYPE]: CUSTOM_OBJECT,
    },
    fields: {
      Id: {
        refType: stringType,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: false,
          [LABEL]: 'Id',
          [API_NAME]: 'Id',
        },
      },
    },
  })
  const masterReferenceExpression = new ReferenceExpression(
    masterElemID,
    masterObj,
  )

  const refToName = 'refToName'
  const refToObj = createCustomObjectType(refToName, {})
  const refToElemID = refToObj.elemID

  const refToMetadataName = 'refToMetadataName'
  const refToMetadataObj = createMetadataTypeElement(refToMetadataName, {})

  const refFromName = 'refFrom'
  const refFromObj = createCustomObjectType(refFromName, {
    fields: {
      LookupExample: {
        refType: Types.primitiveDataTypes.Lookup,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [LABEL]: 'lookup',
          [API_NAME]: 'LookupExample',
          [FIELD_ANNOTATIONS.CREATABLE]: true,
          [FIELD_ANNOTATIONS.UPDATEABLE]: true,
          [FIELD_ANNOTATIONS.REFERENCE_TO]: [refToName],
        },
      },
      NonDeployableLookup: {
        refType: Types.primitiveDataTypes.Lookup,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [LABEL]: 'lookup',
          [API_NAME]: 'LookupExample',
          [FIELD_ANNOTATIONS.CREATABLE]: false,
          [FIELD_ANNOTATIONS.UPDATEABLE]: false,
          [FIELD_ANNOTATIONS.REFERENCE_TO]: [refToName],
        },
      },
      RefToUser: {
        refType: Types.primitiveDataTypes.Lookup,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [LABEL]: 'ref to user',
          [API_NAME]: 'RefToUser',
          [FIELD_ANNOTATIONS.CREATABLE]: true,
          [FIELD_ANNOTATIONS.UPDATEABLE]: true,
          [FIELD_ANNOTATIONS.REFERENCE_TO]: [userObjName],
        },
      },
      MasterDetailExample: {
        refType: Types.primitiveDataTypes.MasterDetail,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [LABEL]: 'detailOfMaster',
          [API_NAME]: 'MasterDetailExample',
          [FIELD_ANNOTATIONS.CREATABLE]: true,
          [FIELD_ANNOTATIONS.UPDATEABLE]: true,
          [FIELD_ANNOTATIONS.REFERENCE_TO]: [masterReferenceExpression],
        },
      },
      HierarchyExample: {
        refType: Types.primitiveDataTypes.Hierarchy,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [LABEL]: 'hierarchy',
          [API_NAME]: 'HierarchyExample',
          [FIELD_ANNOTATIONS.CREATABLE]: true,
          [FIELD_ANNOTATIONS.UPDATEABLE]: true,
        },
      },
      HiddenValueField: {
        refType: Types.primitiveDataTypes.MasterDetail,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [LABEL]: 'hiddenValueField',
          [API_NAME]: 'HiddenValueField',
          [FIELD_ANNOTATIONS.CREATABLE]: true,
          [FIELD_ANNOTATIONS.UPDATEABLE]: true,
          [CORE_ANNOTATIONS.HIDDEN_VALUE]: true,
          [FIELD_ANNOTATIONS.REFERENCE_TO]: [masterName],
        },
      },
      RefToMetadataField: {
        refType: Types.primitiveDataTypes.Lookup,
        annotations: {
          [CORE_ANNOTATIONS.REQUIRED]: true,
          [LABEL]: 'lookupMetadataField',
          [API_NAME]: 'LookupMetadataField',
          [FIELD_ANNOTATIONS.CREATABLE]: true,
          [FIELD_ANNOTATIONS.UPDATEABLE]: true,
          [FIELD_ANNOTATIONS.REFERENCE_TO]: [refToMetadataName],
        },
      },
    },
  })
  const refFromElemID = refFromObj.elemID
  let elements: Element[]
  const refToMetadataInstanceName = 'refToMetadataInstance'
  const refToMetadataInstanceId = 'refToMetadataId'
  const refToMetadataInstance = new InstanceElement(
    refToMetadataInstanceName,
    refToMetadataObj,
    {
      [INTERNAL_ID_FIELD]: refToMetadataInstanceId,
    },
  )
  const refFromValues = {
    Id: '1234',
    LookupExample: 'refToId',
    MasterDetailExample: 'masterToId',
    HierarchyExample: '1234', // hierarchy refs can only refer to the same type
    NonDeployableLookup: 'ToNothing',
    HiddenValueField: 'ToNothing',
    RefToUser: 'aaa',
    RefToMetadataField: refToMetadataInstanceId,
  }
  const refToInstanceName = 'refToInstance'
  const refToInstance = new InstanceElement(refToInstanceName, refToObj, {
    Id: 'refToId',
  })
  const refFromEmptyRefsValues = {
    Id: '5678',
    LookupExample: 'refToNothing',
    MasterDetailExample: 'masterOfNone',
  }
  const refFromEmptyRefsName = 'refFromEmptyRefsValues'
  const refFromEmptyRefsInstance = new InstanceElement(
    refFromEmptyRefsName,
    refFromObj,
    refFromEmptyRefsValues,
  )
  const refFromInstanceName = 'refFromInstance'
  const refFromInstance = new InstanceElement(
    refFromInstanceName,
    refFromObj,
    refFromValues,
  )
  const masterToInstanceName = 'masterToInstance'
  const masterToInstance = new InstanceElement(
    masterToInstanceName,
    masterObj,
    {
      Id: 'masterToId',
      MasterDetailExample: '',
    },
  )
  const duplicateInstName = 'duplicateInstance'
  const firstDupInst = new InstanceElement(duplicateInstName, refToObj, {
    Id: 'duplicateId-1',
  })
  const secondDupInst = new InstanceElement(duplicateInstName, refToObj, {
    Id: 'duplicateId-2',
  })
  const refFromToDupName = 'refFromToDuplicateInstance'
  const refFromToDupInst = new InstanceElement(refFromToDupName, refFromObj, {
    Id: 'toDuplicate',
    LookupExample: 'duplicateId-1',
    MasterDetailExample: 'duplicateId-2',
  })
  const refFromToRefToDupName = 'refFromToRefToDupInstance'
  const refFromToRefToDupInst = new InstanceElement(
    refFromToRefToDupName,
    refFromObj,
    {
      Id: 'toToDuplicate',
      LookupExample: 'toDuplicate',
    },
  )
  const objects = [refFromObj, refToObj, masterObj, userObj]
  const legalInstances = [
    refToInstance,
    refToMetadataInstance,
    refFromInstance,
    masterToInstance,
  ]
  const illegalInstances = [
    refFromEmptyRefsInstance,
    firstDupInst,
    secondDupInst,
  ]
  const sideEffectIllegalInstances = [refFromToDupInst, refFromToRefToDupInst]
  const allElements = [
    ...objects,
    ...legalInstances,
    ...illegalInstances,
    ...sideEffectIllegalInstances,
  ]
  let errors: SaltoError[]

  beforeAll(() => {
    client = mockClient().client
  })

  describe('lookup ref to', () => {
    describe('full fetch', () => {
      beforeEach(async () => {
        filter = filterCreator({
          client,
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              fetchParams: {
                data: {
                  includeObjects: ['*'],
                  saltoIDSettings: {
                    defaultIdFields: ['Name'],
                  },
                },
              },
            }),
          },
        }) as FilterType

        elements = allElements.map((e) => e.clone())
        const fetchResult = await filter.onFetch(elements)
        if (fetchResult) {
          errors = fetchResult.errors ?? []
        }
      })

      it('should drop the illegal instances and not change the objects and the ref to instances', () => {
        expect(elements.length).toEqual(objects.length + legalInstances.length)

        // object types
        expect(
          elements.find((e) => e.elemID.isEqual(refFromElemID)),
        ).toMatchObject(refFromObj)
        expect(
          elements.find((e) => e.elemID.isEqual(refToElemID)),
        ).toMatchObject(refToObj)
        expect(
          elements.find((e) => e.elemID.isEqual(masterElemID)),
        ).toMatchObject(masterObj)
        expect(
          elements.find((e) => e.elemID.isEqual(userElemID)),
        ).toMatchObject(userObj)

        // instances with refs to only
        expect(
          elements.find((e) => e.elemID.isEqual(refToInstance.elemID)),
        ).toMatchObject(refToInstance)
        expect(
          elements.find((e) => e.elemID.isEqual(masterToInstance.elemID)),
        ).toMatchObject(masterToInstance)
      })

      it('should replace lookup and master values with reference and not replace ref to user', () => {
        const afterFilterRefToInst = elements
          .filter(isInstanceElement)
          .find((e) =>
            e.elemID.isEqual(refFromInstance.elemID),
          ) as InstanceElement
        expect(afterFilterRefToInst).toBeDefined()
        expect(afterFilterRefToInst.value).toEqual({
          Id: '1234',
          LookupExample: new ReferenceExpression(refToInstance.elemID),
          MasterDetailExample: new ReferenceExpression(masterToInstance.elemID),
          HierarchyExample: new ReferenceExpression(refFromInstance.elemID),
          NonDeployableLookup: 'ToNothing',
          RefToUser: 'aaa',
          HiddenValueField: 'ToNothing',
          RefToMetadataField: new ReferenceExpression(
            refToMetadataInstance.elemID,
          ),
        })
      })

      it('should drop the referencing instance if ref is to non existing instance', () => {
        const afterFilterEmptyRefToInst = elements.find((e) =>
          e.elemID.isEqual(refFromEmptyRefsInstance.elemID),
        )
        expect(afterFilterEmptyRefToInst).toBeUndefined()
      })

      it('should drop instances with duplicate elemIDs', () => {
        const afterFilterFirstDup = elements.find((e) =>
          e.elemID.isEqual(firstDupInst.elemID),
        )
        const afterFilterSecondDup = elements.find((e) =>
          e.elemID.isEqual(secondDupInst.elemID),
        )
        expect(afterFilterFirstDup).toBeUndefined()
        expect(afterFilterSecondDup).toBeUndefined()
      })

      it('should drop instances with ref to instances that have elemID duplications', () => {
        const afterFilterRefFromToDup = elements.find((e) =>
          e.elemID.isEqual(refFromToDupInst.elemID),
        )
        expect(afterFilterRefFromToDup).toBeUndefined()
      })

      it('should drop instances with ref to instances that have refs to inst with elemID duplications', () => {
        const afterFilterRefFromToRefToDup = elements.find((e) =>
          e.elemID.isEqual(refFromToRefToDupInst.elemID),
        )
        expect(afterFilterRefFromToRefToDup).toBeUndefined()
      })

      it('should have warnings that include all illegal instances names/Ids', () => {
        expect(errors).toBeDefined()
        illegalInstances.forEach((instance) => {
          const errorMessages = errors.map((error) => error.message)
          const warningsIncludeNameOrId =
            errorMessages.some((errorMsg) =>
              errorMsg.includes(instance.elemID.name),
            ) ||
            errorMessages.some((errorMsg) =>
              errorMsg.includes(instance.value.Id),
            )
          expect(warningsIncludeNameOrId).toBeTruthy()
        })
      })

      it('should have a warning for the missing references', () => {
        expect(errors).toBeDefined()

        const missingReferencesTo: string[] = [
          masterElemID.getFullName(),
          refToName,
        ]
        const errorMessages = errors.map((error) => error.message)
        const warningsIncludeMissingReferences = errorMessages.some(
          (errorMsg) =>
            missingReferencesTo.every((to) => errorMsg.includes(to)),
        )
        expect(warningsIncludeMissingReferences).toBeTruthy()
      })

      describe('when instances with empty Salto ID exist', () => {
        let instancesWithEmptyNames: InstanceElement[]
        beforeEach(async () => {
          instancesWithEmptyNames = [
            new InstanceElement(ElemID.CONFIG_NAME, mockTypes.Product2, {
              [CUSTOM_OBJECT_ID_FIELD]: '01t8d000003NIL3AAO',
            }),
            new InstanceElement(ElemID.CONFIG_NAME, mockTypes.Product2, {
              [CUSTOM_OBJECT_ID_FIELD]: '01t3f005723ACL3AAO',
            }),
            new InstanceElement(ElemID.CONFIG_NAME, mockTypes.Account, {
              [CUSTOM_OBJECT_ID_FIELD]: '0018d00000PxfVvAAJ',
            }),
          ]
          elements = instancesWithEmptyNames.map((instance) => instance.clone())
          const fetchResult = await filter.onFetch(elements)
          errors = fetchResult ? fetchResult.errors ?? [] : []
        })
        it('should create fetch warnings and omit the instances', () => {
          expect(errors).toIncludeSameMembers([
            expect.objectContaining({
              severity: 'Warning',
              message:
                expect.stringContaining('collisions') &&
                expect.stringContaining('Product2'),
            }),
            expect.objectContaining({
              severity: 'Warning',
              message: expect.stringContaining(
                'Omitted Instance of type Account',
              ),
            }),
          ])
          expect(elements).not.toIncludeAnyMembers(instancesWithEmptyNames)
        })
      })
    })
    describe('fetch with changes detection', () => {
      const changedAtSingleton = mockInstances()[CHANGED_AT_SINGLETON]
      beforeEach(async () => {
        const elementsSource = buildElementsSourceFromElements([
          ...objects,
          refToInstance,
          masterToInstance,
          refToMetadataInstance,
        ])
        filter = filterCreator({
          client,
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              fetchParams: {
                data: {
                  includeObjects: ['*'],
                  saltoIDSettings: {
                    defaultIdFields: ['Name'],
                  },
                },
              },
              metadataQuery:
                await buildMetadataQueryForFetchWithChangesDetection({
                  fetchParams: {},
                  elementsSource: buildElementsSourceFromElements([
                    changedAtSingleton,
                  ]),
                  lastChangeDateOfTypesWithNestedInstances:
                    emptyLastChangeDateOfTypesWithNestedInstances(),
                  customObjectsWithDeletedFields: new Set(),
                }),
            }),
            elementsSource,
          },
        }) as FilterType

        elements = [refFromInstance.clone()]
        const fetchResult = await filter.onFetch(elements)
        if (fetchResult) {
          errors = fetchResult.errors ?? []
        }
      })
      it('should resolve references to instances in the elements source', () => {
        const afterFilterRefToInst = elements
          .filter(isInstanceElement)
          .find((e) =>
            e.elemID.isEqual(refFromInstance.elemID),
          ) as InstanceElement
        expect(afterFilterRefToInst).toBeDefined()
        expect(afterFilterRefToInst.value).toEqual({
          Id: '1234',
          LookupExample: new ReferenceExpression(refToInstance.elemID),
          MasterDetailExample: new ReferenceExpression(masterToInstance.elemID),
          HierarchyExample: new ReferenceExpression(refFromInstance.elemID),
          NonDeployableLookup: 'ToNothing',
          RefToUser: 'aaa',
          HiddenValueField: 'ToNothing',
          RefToMetadataField: new ReferenceExpression(
            refToMetadataInstance.elemID,
          ),
        })
      })
    })
  })

  describe('Broken refs behavior', () => {
    const testElements = [
      ...objects,
      ...legalInstances,
      refFromEmptyRefsInstance,
    ]
    const buildTestFetchProfile = (
      defaultBehavior: OutgoingReferenceBehavior,
      overrides: Record<string, OutgoingReferenceBehavior>,
    ): FetchProfile =>
      buildFetchProfile({
        fetchParams: {
          data: {
            includeObjects: ['*'],
            saltoIDSettings: {
              defaultIdFields: ['Name'],
            },
            brokenOutgoingReferencesSettings: {
              defaultBehavior,
              perTargetTypeOverrides: overrides,
            },
          },
        },
      })
    describe('When default is BrokenReference and override is InternalId', () => {
      beforeEach(async () => {
        filter = filterCreator({
          client,
          config: {
            ...defaultFilterContext,
            fetchProfile: buildTestFetchProfile('BrokenReference', {
              User: 'InternalId',
            }),
          },
        }) as FilterType
        elements = testElements.map((e) => e.clone())
        const fetchResult = await filter.onFetch(elements)
        if (fetchResult) {
          errors = fetchResult.errors ?? []
        }
      })
      it('Should not exclude any elements', () => {
        expect(elements.length).toEqual(testElements.length)
      })
      it('Should keep the internal ID for overridden type', () => {
        const refFromElement = elements
          .filter(isInstanceElement)
          .filter((e) => e.elemID.isEqual(refFromInstance.elemID))
          .pop()
        expect(refFromElement?.value).toHaveProperty('RefToUser', 'aaa')
      })
      it('Should create broken refs by default', () => {
        const elementWithBadRefs = elements
          .filter(isInstanceElement)
          .filter((e) => e.elemID.isEqual(refFromEmptyRefsInstance.elemID))
          .pop()
        expect(elementWithBadRefs?.value).toHaveProperty(
          'LookupExample',
          new ReferenceExpression(
            refToElemID.createNestedID(
              'instance',
              `${MISSING_REF_PREFIX}refToNothing`,
            ),
          ),
        )
        expect(elementWithBadRefs?.value).toHaveProperty(
          'MasterDetailExample',
          new ReferenceExpression(
            masterElemID.createNestedID(
              'instance',
              `${MISSING_REF_PREFIX}masterOfNone`,
            ),
          ),
        )
      })
    })
    describe('When default is BrokenReference and override is ExcludeInstance', () => {
      beforeEach(async () => {
        filter = filterCreator({
          client,
          config: {
            ...defaultFilterContext,
            fetchProfile: buildTestFetchProfile('BrokenReference', {
              User: 'ExcludeInstance',
            }),
          },
        }) as FilterType
        elements = testElements.map((e) => e.clone())
        const fetchResult = await filter.onFetch(elements)
        if (fetchResult) {
          errors = fetchResult.errors ?? []
        }
      })
      it('Should exclude the element with the bad ref', () => {
        expect(elements.length).toEqual(testElements.length - 1)
        expect(
          elements.filter((e) => e.elemID.isEqual(refFromInstance.elemID)),
        ).toBeEmpty()
      })
      it('Should create broken refs by default', () => {
        const elementWithBadRefs = elements
          .filter(isInstanceElement)
          .filter((e) => e.elemID.isEqual(refFromEmptyRefsInstance.elemID))
          .pop()
        expect(elementWithBadRefs?.value).toHaveProperty(
          'LookupExample',
          new ReferenceExpression(
            refToElemID.createNestedID(
              'instance',
              `${MISSING_REF_PREFIX}refToNothing`,
            ),
          ),
        )
        expect(elementWithBadRefs?.value).toHaveProperty(
          'MasterDetailExample',
          new ReferenceExpression(
            masterElemID.createNestedID(
              'instance',
              `${MISSING_REF_PREFIX}masterOfNone`,
            ),
          ),
        )
      })
    })
    describe('When default is ExcludeInstance and override is BrokenReference', () => {
      beforeEach(async () => {
        filter = filterCreator({
          client,
          config: {
            ...defaultFilterContext,
            fetchProfile: buildTestFetchProfile('ExcludeInstance', {
              User: 'BrokenReference',
            }),
          },
        }) as FilterType
        elements = testElements.map((e) => e.clone())
        const fetchResult = await filter.onFetch(elements)
        if (fetchResult) {
          errors = fetchResult.errors ?? []
        }
      })
      it('Should exclude the element with the bad ref', () => {
        expect(elements.length).toEqual(testElements.length - 1)
        expect(
          elements.filter((e) =>
            e.elemID.isEqual(refFromEmptyRefsInstance.elemID),
          ),
        ).toBeEmpty()
      })
      it('Should create broken refs for overridden type', () => {
        const elementWithUserRef = elements
          .filter(isInstanceElement)
          .filter((e) => e.elemID.isEqual(refFromInstance.elemID))
          .pop()
        expect(elementWithUserRef?.value).toHaveProperty(
          'RefToUser',
          new ReferenceExpression(
            userObj.elemID.createNestedID(
              'instance',
              `${MISSING_REF_PREFIX}aaa`,
            ),
          ),
        )
      })
    })
    describe('When default is ExcludeInstance and override is InternalId', () => {
      beforeEach(async () => {
        filter = filterCreator({
          client,
          config: {
            ...defaultFilterContext,
            fetchProfile: buildTestFetchProfile('ExcludeInstance', {
              User: 'InternalId',
            }),
          },
        }) as FilterType
        elements = testElements.map((e) => e.clone())
        const fetchResult = await filter.onFetch(elements)
        if (fetchResult) {
          errors = fetchResult.errors ?? []
        }
      })
      it('Should exclude the element with the bad ref', () => {
        expect(elements.length).toEqual(testElements.length - 1)
        expect(
          elements.filter((e) =>
            e.elemID.isEqual(refFromEmptyRefsInstance.elemID),
          ),
        ).toBeEmpty()
      })
      it('Should keep the internal ID for overridden type', () => {
        const refFromElement = elements
          .filter(isInstanceElement)
          .filter((e) => e.elemID.isEqual(refFromInstance.elemID))
          .pop()
        expect(refFromElement?.value).toHaveProperty('RefToUser', 'aaa')
      })
    })
    describe('When default is InternalId and override is ExcludeInstance', () => {
      beforeEach(async () => {
        filter = filterCreator({
          client,
          config: {
            ...defaultFilterContext,
            fetchProfile: buildTestFetchProfile('InternalId', {
              User: 'ExcludeInstance',
            }),
          },
        }) as FilterType
        elements = testElements.map((e) => e.clone())
        const fetchResult = await filter.onFetch(elements)
        if (fetchResult) {
          errors = fetchResult.errors ?? []
        }
      })
      it('Should exclude the element with the overridden type', () => {
        expect(elements.length).toEqual(testElements.length - 1)
        expect(
          elements.filter((e) => e.elemID.isEqual(refFromInstance.elemID)),
        ).toBeEmpty()
      })
      it('Should keep the internal ID by default', () => {
        const elementWithBadRefs = elements
          .filter(isInstanceElement)
          .filter((e) => e.elemID.isEqual(refFromEmptyRefsInstance.elemID))
          .pop()
        expect(elementWithBadRefs?.value).toHaveProperty(
          'LookupExample',
          'refToNothing',
        )
        expect(elementWithBadRefs?.value).toHaveProperty(
          'MasterDetailExample',
          'masterOfNone',
        )
      })
    })
    describe('When default is InternalId and override is BrokenReference', () => {
      beforeEach(async () => {
        filter = filterCreator({
          client,
          config: {
            ...defaultFilterContext,
            fetchProfile: buildTestFetchProfile('InternalId', {
              User: 'BrokenReference',
            }),
          },
        }) as FilterType
        elements = testElements.map((e) => e.clone())
        const fetchResult = await filter.onFetch(elements)
        if (fetchResult) {
          errors = fetchResult.errors ?? []
        }
      })
      it('Should not exclude any elements', () => {
        expect(elements.length).toEqual(testElements.length)
      })
      it('Should keep the internal ID by default', () => {
        const elementWithBadRefs = elements
          .filter(isInstanceElement)
          .filter((e) => e.elemID.isEqual(refFromEmptyRefsInstance.elemID))
          .pop()
        expect(elementWithBadRefs?.value).toHaveProperty(
          'LookupExample',
          'refToNothing',
        )
        expect(elementWithBadRefs?.value).toHaveProperty(
          'MasterDetailExample',
          'masterOfNone',
        )
      })
      it('Should create broken refs for overridden type', () => {
        const elementWithUserRef = elements
          .filter(isInstanceElement)
          .filter((e) => e.elemID.isEqual(refFromInstance.elemID))
          .pop()
        expect(elementWithUserRef?.value).toHaveProperty(
          'RefToUser',
          new ReferenceExpression(
            userObj.elemID.createNestedID(
              'instance',
              `${MISSING_REF_PREFIX}aaa`,
            ),
          ),
        )
      })
    })
  })
})
