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
import {
  Element,
  ElemID,
  ObjectType,
  InstanceElement,
  BuiltinTypes,
  ReferenceExpression,
  CORE_ANNOTATIONS,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import { MockInterface } from '@salto-io/test-utils'
import { collections } from '@salto-io/lowerdash'
import { FilterResult } from '../../src/filter'
import SalesforceClient from '../../src/client/client'
import filterCreator, {
  WARNING_MESSAGE,
} from '../../src/filters/extra_dependencies'
import mockClient from '../client'
import { createMetadataTypeElement, defaultFilterContext } from '../utils'
import {
  SALESFORCE,
  API_NAME,
  METADATA_TYPE,
  INSTANCE_FULL_NAME_FIELD,
  CUSTOM_FIELD,
  INTERNAL_ID_FIELD,
  INTERNAL_ID_ANNOTATION,
  CUSTOM_OBJECT,
} from '../../src/constants'
import { SalesforceRecord } from '../../src/client/types'
import { Types } from '../../src/transformers/transformer'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import Connection from '../../src/client/jsforce'
import { FilterWith } from './mocks'

const getGeneratedDeps = (elem: Element): ReferenceExpression[] =>
  elem.annotations[CORE_ANNOTATIONS.GENERATED_DEPENDENCIES]

describe('extra dependencies filter', () => {
  let client: SalesforceClient
  type FilterType = FilterWith<'onFetch'>
  let filter: FilterType

  let customObjType: ObjectType
  let leadObjType: ObjectType
  let instances: InstanceElement[]
  let workspaceInstance: InstanceElement
  let elements: Element[]
  let elementsSource: ReadOnlyElementsSource
  beforeEach(() => {
    jest.clearAllMocks()
    jest.resetAllMocks()
    const mdType = createMetadataTypeElement('meta', {
      fields: {
        fieldName: { refType: BuiltinTypes.STRING },
        [INSTANCE_FULL_NAME_FIELD]: { refType: BuiltinTypes.SERVICE_ID },
      },
    })
    const layoutObjType = createMetadataTypeElement('Layout', {})
    customObjType = new ObjectType({
      elemID: new ElemID(SALESFORCE, 'obj__c'),
      annotations: {
        [METADATA_TYPE]: CUSTOM_OBJECT,
        [API_NAME]: 'obj__c',
      },
      fields: {
        first: {
          refType: Types.primitiveDataTypes.Text,
          annotations: {
            [API_NAME]: 'obj__c.first__c',
            [INTERNAL_ID_ANNOTATION]: 'first field',
          },
        },
        second: {
          refType: Types.primitiveDataTypes.Number,
          annotations: {
            [API_NAME]: 'obj__c.second__c',
            [INTERNAL_ID_ANNOTATION]: 'second field',
          },
        },
      },
    })
    leadObjType = new ObjectType({
      elemID: new ElemID(SALESFORCE, 'Lead'),
      annotations: {
        [METADATA_TYPE]: CUSTOM_OBJECT,
        [API_NAME]: 'Lead',
      },
      fields: {
        custom: {
          refType: Types.primitiveDataTypes.Text,
          annotations: {
            [API_NAME]: 'Lead.custom__c',
            [INTERNAL_ID_ANNOTATION]: 'lead field',
          },
        },
      },
    })
    instances = [
      new InstanceElement('inst1', mdType, {
        fieldName: new ReferenceExpression(customObjType.fields.first.elemID),
        [INTERNAL_ID_FIELD]: 'inst1 id',
        [INSTANCE_FULL_NAME_FIELD]: 'inst1',
      }),
      new InstanceElement('inst2', mdType, {
        fieldName: 'obj__c.first__c',
        [INTERNAL_ID_FIELD]: 'inst2 id',
        [INSTANCE_FULL_NAME_FIELD]: 'inst2',
      }),
      new InstanceElement('layoutId1', layoutObjType, {
        [INTERNAL_ID_FIELD]: 'layoutId1',
      }),
    ]
    const otherMdType = createMetadataTypeElement('meta2', {})
    workspaceInstance = new InstanceElement('inst3', otherMdType, {
      [INTERNAL_ID_FIELD]: 'inst3 id',
      [INSTANCE_FULL_NAME_FIELD]: 'inst3',
    })
    elementsSource = buildElementsSourceFromElements([
      otherMdType,
      workspaceInstance,
    ])
    elements = [mdType, layoutObjType, customObjType, leadObjType, ...instances]
    client = mockClient().client
  })

  describe('onFetch v1', () => {
    beforeEach(() => {
      filter = filterCreator({
        client,
        config: {
          ...defaultFilterContext,
          fetchProfile: buildFetchProfile({
            fetchParams: {
              target: ['meta'],
              optionalFeatures: { extraDependenciesV2: false },
            },
          }),
          elementsSource,
        },
      }) as FilterType
    })
    describe('resolve internal ids', () => {
      let numElements: number
      let mockQueryAll: jest.Mock

      async function* mockQueryAllImpl(): AsyncIterable<SalesforceRecord[]> {
        yield [
          {
            MetadataComponentType: 'meta',
            MetadataComponentId: 'inst1 id',
            MetadataComponentName: 'inst1',
            RefMetadataComponentType: CUSTOM_FIELD,
            RefMetadataComponentId: 'first field',
            RefMetadataComponentName: 'first field',
          },
          {
            MetadataComponentType: 'meta',
            MetadataComponentId: 'inst1 id',
            MetadataComponentName: 'inst1',
            RefMetadataComponentType: CUSTOM_FIELD,
            RefMetadataComponentId: 'second field',
            RefMetadataComponentName: 'second field',
          },
          {
            MetadataComponentType: 'meta',
            MetadataComponentId: 'inst1 id',
            MetadataComponentName: 'inst1',
            RefMetadataComponentType: 'meta2',
            RefMetadataComponentId: 'inst3 id',
            RefMetadataComponentName: 'inst3',
          },
          {
            MetadataComponentType: 'meta2',
            MetadataComponentId: 'inst3 id',
            MetadataComponentName: 'inst3',
            RefMetadataComponentType: 'meta',
            RefMetadataComponentId: 'inst2 id',
            RefMetadataComponentName: 'inst2',
          },
          {
            MetadataComponentType: CUSTOM_FIELD,
            MetadataComponentId: 'lead field',
            MetadataComponentName: 'lead field',
            RefMetadataComponentType: CUSTOM_FIELD,
            RefMetadataComponentId: 'second field',
            RefMetadataComponentName: 'second field',
          },
          {
            MetadataComponentType: 'meta',
            MetadataComponentId: 'inst2 id',
            MetadataComponentName: 'inst2',
            RefMetadataComponentType: CUSTOM_FIELD,
            RefMetadataComponentId: 'first field',
            RefMetadataComponentName: 'first field',
          },
        ] as unknown as SalesforceRecord[]
        yield [
          {
            MetadataComponentType: 'meta',
            MetadataComponentId: 'inst2 id',
            MetadataComponentName: 'inst2',
            RefMetadataComponentType: CUSTOM_FIELD,
            RefMetadataComponentId: 'lead field',
            RefMetadataComponentName: 'lead field',
          },
          {
            MetadataComponentType: 'meta',
            MetadataComponentId: 'inst2 id',
            MetadataComponentName: 'inst2',
            RefMetadataComponentType: CUSTOM_FIELD,
            RefMetadataComponentId: 'unknown field',
            RefMetadataComponentName: 'unknown field',
          },
          {
            MetadataComponentType: 'meta',
            MetadataComponentId: 'inst2 id',
            MetadataComponentName: 'inst2',
            RefMetadataComponentType: 'StandardEntity',
            RefMetadataComponentId: 'Lead',
            RefMetadataComponentName: 'Lead',
          },
          {
            MetadataComponentType: 'meta',
            MetadataComponentId: 'unknown src id',
            MetadataComponentName: 'unknown src name',
            RefMetadataComponentType: CUSTOM_FIELD,
            RefMetadataComponentId: 'custom id',
            RefMetadataComponentName: 'custom name',
          },
        ] as unknown as SalesforceRecord[]
      }

      async function* mockQueryAllImplEmpty(): AsyncIterable<
        SalesforceRecord[]
      > {
        yield [] as unknown as SalesforceRecord[]
      }

      async function* mockQueryAllImplLayout(): AsyncIterable<
        SalesforceRecord[]
      > {
        yield [
          {
            MetadataComponentType: 'Layout',
            MetadataComponentId: 'layoutId1',
            MetadataComponentName: 'layout1 name',
            RefMetadataComponentType: CUSTOM_FIELD,
            RefMetadataComponentId: 'first field',
            RefMetadataComponentName: 'first field',
          },
        ] as unknown as SalesforceRecord[]
      }

      beforeEach(async () => {
        mockQueryAll = jest
          .fn()
          .mockImplementationOnce(mockQueryAllImplLayout)
          .mockImplementationOnce(mockQueryAllImplEmpty)
          .mockImplementationOnce(mockQueryAllImplEmpty)
          .mockImplementationOnce(mockQueryAllImplEmpty)
          .mockImplementationOnce(mockQueryAllImplEmpty)
          .mockImplementationOnce(mockQueryAllImpl)
        SalesforceClient.prototype.queryAll = mockQueryAll
        numElements = elements.length
      })

      describe('when toolingDepsOfCurrentNamespace is disabled', () => {
        beforeEach(async () => {
          filter = filterCreator({
            client,
            config: {
              ...defaultFilterContext,
              fetchProfile: buildFetchProfile({
                fetchParams: {
                  target: ['meta'],
                  optionalFeatures: {
                    toolingDepsOfCurrentNamespace: false,
                    extraDependenciesV2: false,
                  },
                },
              }),
              elementsSource,
            },
          }) as FilterType
          await filter.onFetch(elements)
        })
        it('should not change # of elements', () => {
          expect(elements.length).toEqual(numElements)
        })

        it('should add field dependencies to instances', () => {
          const firstFieldRef = new ReferenceExpression(
            customObjType.fields.first.elemID,
          )
          const secondFieldRef = new ReferenceExpression(
            customObjType.fields.second.elemID,
          )
          const leadFieldRef = new ReferenceExpression(
            leadObjType.fields.custom.elemID,
          )
          expect(getGeneratedDeps(instances[0])).toContainEqual({
            reference: secondFieldRef,
          })
          expect(getGeneratedDeps(instances[1])).toEqual(
            expect.arrayContaining([
              { reference: firstFieldRef },
              { reference: leadFieldRef },
            ]),
          )
          expect(getGeneratedDeps(instances[2])).toEqual([
            { reference: firstFieldRef },
          ])
        })

        it('should not add generated dependencies to targets that already have a reference in the element', () => {
          expect(getGeneratedDeps(instances[0])).not.toContainEqual({
            reference: new ReferenceExpression(
              customObjType.fields.first.elemID,
            ),
          })
        })

        it('should add dependencies to standard objects', () => {
          expect(getGeneratedDeps(instances[1])).toEqual(
            expect.arrayContaining([
              { reference: new ReferenceExpression(leadObjType.elemID) },
            ]),
          )
        })

        it('should add generated dependencies annotation to fields', () => {
          expect(getGeneratedDeps(leadObjType.fields.custom)).toEqual([
            {
              reference: new ReferenceExpression(
                customObjType.fields.second.elemID,
              ),
            },
          ])
        })

        it('should sort generated dependencies by name', () => {
          expect(getGeneratedDeps(instances[1])).toEqual([
            { reference: new ReferenceExpression(leadObjType.elemID) },
            {
              reference: new ReferenceExpression(
                leadObjType.fields.custom.elemID,
              ),
            },
            {
              reference: new ReferenceExpression(
                customObjType.fields.first.elemID,
              ),
            },
          ])
        })

        it('should have individual queries for types marked for individual query', () => {
          expect(mockQueryAll).toHaveBeenCalledTimes(6)
          mockQueryAll.mock.calls.forEach(([query]: [string, boolean]) => {
            expect(query).not.toContain('MetadataComponentNamespace')
          })
        })

        it('should add generated dependencies to elements that were not fetched', () => {
          expect(getGeneratedDeps(instances[0])).toContainEqual({
            reference: new ReferenceExpression(workspaceInstance.elemID),
          })
        })

        it('should not modify workspace elements that were not fetched', () => {
          expect(getGeneratedDeps(workspaceInstance)).toBeUndefined()
        })
      })
      describe('when toolingDepsOfCurrentNamespace is enabled', () => {
        beforeEach(async () => {
          filter = filterCreator({
            client,
            config: {
              ...defaultFilterContext,
              fetchProfile: buildFetchProfile({
                fetchParams: {
                  target: ['meta'],
                  optionalFeatures: {
                    toolingDepsOfCurrentNamespace: true,
                    extraDependenciesV2: false,
                  },
                },
              }),
              elementsSource: buildElementsSourceFromElements(elements),
            },
          }) as FilterType
          await filter.onFetch(elements)
        })
        it('should have individual queries for types marked for individual query', () => {
          expect(mockQueryAll).toHaveBeenCalledTimes(12)
          mockQueryAll.mock.calls.forEach(([query]: [string, boolean]) => {
            expect(query).toContain('MetadataComponentNamespace')
          })
        })
      })
    })

    describe('when feature is throwing an error', () => {
      const mockQueryAll: jest.Mock = jest.fn()
      SalesforceClient.prototype.queryAll = mockQueryAll

      it('should return a warning', async () => {
        const { connection } = mockClient()
        connection.query.mockImplementation(() => {
          throw new Error()
        })
        const res = (await filter.onFetch(elements)) as FilterResult
        const err = res.errors ?? []
        expect(res.errors).toHaveLength(1)
        expect(err[0]).toEqual({
          severity: 'Warning',
          message: WARNING_MESSAGE,
        })
      })
    })

    describe('when feature is disabled', () => {
      let connection: MockInterface<Connection>
      beforeEach(async () => {
        const mockClientInst = mockClient()
        client = mockClientInst.client
        connection = mockClientInst.connection
        filter = filterCreator({
          client,
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              fetchParams: {
                optionalFeatures: {
                  extraDependencies: false,
                  extraDependenciesV2: false,
                },
              },
            }),
            elementsSource: buildElementsSourceFromElements(elements),
          },
        }) as FilterType
        await filter.onFetch(elements)
      })

      it('should not run any query', () => {
        expect(connection.query).not.toHaveBeenCalled()
      })
    })
  })

  describe('onFetch v2', () => {
    let queryAllSpy: jest.SpyInstance

    async function* mockQueryAllImpl(): AsyncIterable<SalesforceRecord[]> {
      yield [
        {
          MetadataComponentType: 'meta',
          MetadataComponentId: 'inst1 id',
          MetadataComponentName: 'inst1',
          RefMetadataComponentType: CUSTOM_FIELD,
          RefMetadataComponentId: 'first field',
          RefMetadataComponentName: 'first field',
        },
        {
          MetadataComponentType: 'meta',
          MetadataComponentId: 'inst1 id',
          MetadataComponentName: 'inst1',
          RefMetadataComponentType: CUSTOM_FIELD,
          RefMetadataComponentId: 'second field',
          RefMetadataComponentName: 'second field',
        },
        {
          MetadataComponentType: 'meta',
          MetadataComponentId: 'inst1 id',
          MetadataComponentName: 'inst1',
          RefMetadataComponentType: 'meta2',
          RefMetadataComponentId: 'inst3 id',
          RefMetadataComponentName: 'inst3',
        },
        {
          MetadataComponentType: 'meta2',
          MetadataComponentId: 'inst3 id',
          MetadataComponentName: 'inst3',
          RefMetadataComponentType: 'meta',
          RefMetadataComponentId: 'inst2 id',
          RefMetadataComponentName: 'inst2',
        },
        {
          MetadataComponentType: CUSTOM_FIELD,
          MetadataComponentId: 'lead field',
          MetadataComponentName: 'lead field',
          RefMetadataComponentType: CUSTOM_FIELD,
          RefMetadataComponentId: 'second field',
          RefMetadataComponentName: 'second field',
        },
        {
          MetadataComponentType: 'meta',
          MetadataComponentId: 'inst2 id',
          MetadataComponentName: 'inst2',
          RefMetadataComponentType: CUSTOM_FIELD,
          RefMetadataComponentId: 'first field',
          RefMetadataComponentName: 'first field',
        },
      ] as unknown as SalesforceRecord[]
      yield [
        {
          MetadataComponentType: 'meta',
          MetadataComponentId: 'inst2 id',
          MetadataComponentName: 'inst2',
          RefMetadataComponentType: CUSTOM_FIELD,
          RefMetadataComponentId: 'lead field',
          RefMetadataComponentName: 'lead field',
        },
        {
          MetadataComponentType: 'meta',
          MetadataComponentId: 'inst2 id',
          MetadataComponentName: 'inst2',
          RefMetadataComponentType: CUSTOM_FIELD,
          RefMetadataComponentId: 'unknown field',
          RefMetadataComponentName: 'unknown field',
        },
        {
          MetadataComponentType: 'meta',
          MetadataComponentId: 'inst2 id',
          MetadataComponentName: 'inst2',
          RefMetadataComponentType: 'StandardEntity',
          RefMetadataComponentId: 'Lead',
          RefMetadataComponentName: 'Lead',
        },
        {
          MetadataComponentType: 'meta',
          MetadataComponentId: 'unknown src id',
          MetadataComponentName: 'unknown src name',
          RefMetadataComponentType: CUSTOM_FIELD,
          RefMetadataComponentId: 'custom id',
          RefMetadataComponentName: 'custom name',
        },
      ] as unknown as SalesforceRecord[]
      yield [
        {
          MetadataComponentType: 'Layout',
          MetadataComponentId: 'layoutId1',
          MetadataComponentName: 'layout1 name',
          RefMetadataComponentType: CUSTOM_FIELD,
          RefMetadataComponentId: 'first field',
          RefMetadataComponentName: 'first field',
        },
      ] as unknown as SalesforceRecord[]
    }

    beforeEach(() => {
      queryAllSpy = jest.spyOn(client, 'queryAll')
      queryAllSpy.mockImplementation(mockQueryAllImpl)
      filter = filterCreator({
        client,
        config: {
          ...defaultFilterContext,
          fetchProfile: buildFetchProfile({
            fetchParams: {
              target: ['meta'],
              optionalFeatures: { extraDependenciesV2: true },
            },
          }),
          elementsSource,
        },
      }) as FilterType
    })
    describe('resolve internal ids', () => {
      let numElements: number
      beforeEach(async () => {
        numElements = elements.length
      })

      it('should not change # of elements', async () => {
        await filter.onFetch(elements)
        expect(elements.length).toEqual(numElements)
      })

      it('should add field dependencies to instances', async () => {
        await filter.onFetch(elements)
        const firstFieldRef = new ReferenceExpression(
          customObjType.fields.first.elemID,
        )
        const secondFieldRef = new ReferenceExpression(
          customObjType.fields.second.elemID,
        )
        const leadFieldRef = new ReferenceExpression(
          leadObjType.fields.custom.elemID,
        )
        expect(getGeneratedDeps(instances[0])).toContainEqual({
          reference: secondFieldRef,
        })
        expect(getGeneratedDeps(instances[1])).toEqual(
          expect.arrayContaining([
            { reference: firstFieldRef },
            { reference: leadFieldRef },
          ]),
        )
        expect(getGeneratedDeps(instances[2])).toEqual([
          { reference: firstFieldRef },
        ])
      })

      it('should not add generated dependencies to targets that already have a reference in the element', async () => {
        await filter.onFetch(elements)
        expect(getGeneratedDeps(instances[0])).not.toContainEqual({
          reference: new ReferenceExpression(customObjType.fields.first.elemID),
        })
      })

      it('should add dependencies to standard objects', async () => {
        await filter.onFetch(elements)
        expect(getGeneratedDeps(instances[1])).toEqual(
          expect.arrayContaining([
            { reference: new ReferenceExpression(leadObjType.elemID) },
          ]),
        )
      })

      it('should add generated dependencies annotation to fields', async () => {
        await filter.onFetch(elements)
        expect(getGeneratedDeps(leadObjType.fields.custom)).toEqual([
          {
            reference: new ReferenceExpression(
              customObjType.fields.second.elemID,
            ),
          },
        ])
      })

      it('should sort generated dependencies by name', async () => {
        await filter.onFetch(elements)
        expect(getGeneratedDeps(instances[1])).toEqual([
          { reference: new ReferenceExpression(leadObjType.elemID) },
          {
            reference: new ReferenceExpression(
              leadObjType.fields.custom.elemID,
            ),
          },
          {
            reference: new ReferenceExpression(
              customObjType.fields.first.elemID,
            ),
          },
        ])
      })

      it('should have a single query when Records count is under 2000', async () => {
        await filter.onFetch(elements)
        expect(queryAllSpy).toHaveBeenCalledTimes(1)
      })

      it('should add generated dependencies to elements that were not fetched', async () => {
        await filter.onFetch(elements)
        expect(getGeneratedDeps(instances[0])).toContainEqual({
          reference: new ReferenceExpression(workspaceInstance.elemID),
        })
      })

      it('should not modify workspace elements that were not fetched', async () => {
        await filter.onFetch(elements)
        expect(getGeneratedDeps(workspaceInstance)).toBeUndefined()
      })

      describe('when Records count is over 2000', () => {
        beforeEach(() => {
          const records: SalesforceRecord[] = []
          for (let i = 0; i < 2000; i += 1) {
            records.push({
              Id: `${i}`,
              MetadataComponentType: 'meta',
              MetadataComponentId: 'inst1 id',
              MetadataComponentName: 'inst1',
              RefMetadataComponentType: CUSTOM_FIELD,
              RefMetadataComponentId: 'first field',
              RefMetadataComponentName: 'first field',
            })
            let wasInvoked = false
            queryAllSpy.mockImplementation(() => {
              if (!wasInvoked) {
                wasInvoked = true
                return collections.asynciterable.toAsyncIterable([records])
              }
              return collections.asynciterable.toAsyncIterable([[]])
            })
          }
        })
        it('should have multiple queries', async () => {
          await filter.onFetch(elements)
          const queries = queryAllSpy.mock.calls.map((args) => args[0])
          expect(queries).toHaveLength(3)
          expect(queries[0]).toContain(
            "MetadataComponentId IN ('inst1 id', 'inst2 id', 'layoutId1', 'Lead')",
          )
          expect(queries[1]).toContain(
            "MetadataComponentId IN ('inst1 id', 'inst2 id')",
          )
          expect(queries[2]).toContain(
            "MetadataComponentId IN ('layoutId1', 'Lead')",
          )
        })
      })
    })

    describe('when feature is throwing an error', () => {
      beforeEach(() => {
        queryAllSpy.mockImplementation(() => {
          throw new Error()
        })
      })
      it('should return a warning', async () => {
        const res = (await filter.onFetch(elements)) as FilterResult
        const err = res.errors ?? []
        expect(res.errors).toHaveLength(1)
        expect(err[0]).toEqual({
          severity: 'Warning',
          message: WARNING_MESSAGE,
        })
      })
    })

    describe('when feature is disabled', () => {
      let connection: MockInterface<Connection>
      beforeEach(async () => {
        const mockClientInst = mockClient()
        client = mockClientInst.client
        connection = mockClientInst.connection
        filter = filterCreator({
          client,
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              fetchParams: { optionalFeatures: { extraDependencies: false } },
            }),
            elementsSource: buildElementsSourceFromElements(elements),
          },
        }) as FilterType
        await filter.onFetch(elements)
      })

      it('should not run any query', () => {
        expect(connection.query).not.toHaveBeenCalled()
      })
    })
  })
})
