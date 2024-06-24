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
  BuiltinTypes,
  Change,
  CORE_ANNOTATIONS,
  Element,
  ElemID,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  ObjectType,
  toChange,
} from '@salto-io/adapter-api'
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import _ from 'lodash'
import {
  apiName,
  MetadataTypeAnnotations,
} from '../../src/transformers/transformer'
import * as constants from '../../src/constants'
import filterCreator from '../../src/filters/topics_for_objects'
import {
  defaultFilterContext,
  emptyLastChangeDateOfTypesWithNestedInstances,
} from '../utils'
import { FilterWith } from './mocks'
import { isInstanceOfTypeSync } from '../../src/filters/utils'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import { buildMetadataQueryForFetchWithChangesDetection } from '../../src/fetch_profile/metadata_query'
import { mockInstances } from '../mock_elements'

const {
  TOPICS_FOR_OBJECTS_ANNOTATION,
  TOPICS_FOR_OBJECTS_FIELDS,
  TOPICS_FOR_OBJECTS_METADATA_TYPE,
} = constants
const { ENABLE_TOPICS, ENTITY_API_NAME } = TOPICS_FOR_OBJECTS_FIELDS

describe('Topics for objects filter', () => {
  let filter: FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>

  const mockObject = (name: string, withTopics?: boolean): ObjectType =>
    new ObjectType({
      elemID: new ElemID(constants.SALESFORCE, name),
      annotations: {
        label: 'test label',
        [constants.API_NAME]: name,
        [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
        ...(withTopics === undefined
          ? {}
          : {
              [TOPICS_FOR_OBJECTS_ANNOTATION]: { [ENABLE_TOPICS]: withTopics },
            }),
      },
    })
  describe('onFetch', () => {
    const mockTopicElemID = new ElemID(
      constants.SALESFORCE,
      constants.TOPICS_FOR_OBJECTS_ANNOTATION,
    )

    let topicsForObjectsMetadataType: ObjectType
    let topicsForObjectsType: ObjectType
    let topicsForObjectsInstance: InstanceElement
    let elements: Element[]

    beforeEach(() => {
      filter = filterCreator({ config: defaultFilterContext }) as typeof filter

      topicsForObjectsMetadataType = new ObjectType({
        elemID: mockTopicElemID,
        fields: {
          [ENABLE_TOPICS]: { refType: BuiltinTypes.BOOLEAN },
          [ENTITY_API_NAME]: { refType: BuiltinTypes.STRING },
          [constants.INSTANCE_FULL_NAME_FIELD]: {
            refType: BuiltinTypes.SERVICE_ID,
          },
        },
        annotationRefsOrTypes: {},
        annotations: {
          [constants.METADATA_TYPE]: TOPICS_FOR_OBJECTS_METADATA_TYPE,
        },
      })
      topicsForObjectsInstance = new InstanceElement(
        'Test__c',
        topicsForObjectsMetadataType,
        {
          [ENABLE_TOPICS]: 'true',
          [ENTITY_API_NAME]: 'Test__c',
          [constants.INSTANCE_FULL_NAME_FIELD]: 'Test__c',
        },
      )
      topicsForObjectsType = mockObject('Test__c')
      elements = [
        topicsForObjectsType,
        topicsForObjectsInstance,
        topicsForObjectsMetadataType,
      ]
    })
    it('should add topicsForObjects to object types and remove topics type & instances', async () => {
      await filter.onFetch(elements)
      expect(topicsForObjectsType).toSatisfy(
        (type) =>
          type.annotations[TOPICS_FOR_OBJECTS_ANNOTATION][ENABLE_TOPICS] ===
          true,
      )

      // Check topic instances are deleted and the TopicsForObjects metadataType is hidden
      expect(elements).not.toSatisfy(
        isInstanceOfTypeSync(TOPICS_FOR_OBJECTS_METADATA_TYPE),
      )
      expect(topicsForObjectsMetadataType).toSatisfy(
        (type) => type.annotations[CORE_ANNOTATIONS.HIDDEN] === true,
      )
    })
    describe('when is fetch with changes detection mode', () => {
      const TYPE_WITH_NON_MODIFIED_TOPICS_FOR_OBJECTS = 'Test2__c'

      let typeWithNonModifiedTopicsForObjects: ObjectType

      beforeEach(async () => {
        typeWithNonModifiedTopicsForObjects = mockObject(
          TYPE_WITH_NON_MODIFIED_TOPICS_FOR_OBJECTS,
          true,
        )
        const typeInSource = typeWithNonModifiedTopicsForObjects.clone({
          annotations: {
            [TOPICS_FOR_OBJECTS_ANNOTATION]: { [ENABLE_TOPICS]: true },
          },
        })
        const elementsSource = buildElementsSourceFromElements([
          typeInSource,
          mockInstances().ChangedAtSingleton,
        ])
        filter = filterCreator({
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              fetchParams: {},
              metadataQuery:
                await buildMetadataQueryForFetchWithChangesDetection({
                  fetchParams: {},
                  elementsSource,
                  lastChangeDateOfTypesWithNestedInstances:
                    emptyLastChangeDateOfTypesWithNestedInstances(),
                  customObjectsWithDeletedFields: new Set(),
                }),
            }),
          },
        }) as typeof filter
        elements.push(typeWithNonModifiedTopicsForObjects)
      })
      it('should set correct topicsForObjects on types', async () => {
        await filter.onFetch(elements)
        expect(topicsForObjectsType).toSatisfy(
          (type) =>
            type.annotations[TOPICS_FOR_OBJECTS_ANNOTATION][ENABLE_TOPICS] ===
            true,
        )
        expect(typeWithNonModifiedTopicsForObjects).toSatisfy(
          (type) =>
            type.annotations[TOPICS_FOR_OBJECTS_ANNOTATION][ENABLE_TOPICS] ===
            true,
        )

        // Check topic instances are deleted and the TopicsForObjects metadataType is hidden
        expect(elements).not.toSatisfy(
          isInstanceOfTypeSync(TOPICS_FOR_OBJECTS_METADATA_TYPE),
        )
        expect(topicsForObjectsMetadataType).toSatisfy(
          (type) => type.annotations[CORE_ANNOTATIONS.HIDDEN] === true,
        )
      })
    })

    describe('when fetched elements do not include any CustomObject', () => {
      beforeEach(async () => {
        filter = filterCreator({
          config: defaultFilterContext,
        }) as typeof filter
        _.pullAll(elements, [topicsForObjectsType])
      })
      it('should remove the TopicsForObjects Instances', async () => {
        await filter.onFetch(elements)
        // Check topic instances are deleted and the TopicsForObjects metadataType is hidden
        expect(elements).not.toSatisfyAny(
          isInstanceOfTypeSync(TOPICS_FOR_OBJECTS_METADATA_TYPE),
        )
        expect(topicsForObjectsMetadataType).toSatisfy(
          (type) => type.annotations[CORE_ANNOTATIONS.HIDDEN] === true,
        )
      })
    })
  })

  describe('preDeploy and onDeploy', () => {
    let changes: Change[]
    beforeAll(() => {
      filter = filterCreator({ config: defaultFilterContext }) as typeof filter
    })
    describe('preDeploy', () => {
      beforeAll(async () => {
        changes = [
          toChange({ after: mockObject('Test1__c') }),
          toChange({ after: mockObject('Test2__c', true) }),
          toChange({
            before: mockObject('Test3__c', true),
            after: mockObject('Test3__c', false),
          }),
          toChange({
            before: mockObject('Test4__c'),
            after: mockObject('Test4__c'),
          }),
        ]
        await filter.preDeploy(changes)
      })
      it('should add topics annotation to new types that do not have it', () => {
        expect(getChangeData(changes[0]).annotations).toHaveProperty(
          TOPICS_FOR_OBJECTS_ANNOTATION,
          { [ENABLE_TOPICS]: false },
        )
      })
      it('should not add topics to existing types that do not have it', () => {
        expect(getChangeData(changes[3]).annotations).not.toHaveProperty(
          TOPICS_FOR_OBJECTS_ANNOTATION,
        )
      })
      it('should add instance change to types that have changed topics enabled value', async () => {
        expect(changes).toHaveLength(6)
        const topicsInstanceChanges = changes.slice(4)
        expect(topicsInstanceChanges.map((change) => change.action)).toEqual([
          'add',
          'add',
        ])
        const instances = topicsInstanceChanges.map(
          getChangeData,
        ) as InstanceElement[]
        expect(
          await Promise.all(instances.map((inst) => apiName(inst))),
        ).toEqual(['Test2__c', 'Test3__c'])
        expect(instances.map((inst) => inst.value.enableTopics)).toEqual([
          true,
          false,
        ])

        const topicsForObjectsType = await instances[0].getType()
        expect(topicsForObjectsType.annotations).toMatchObject({
          metadataType: TOPICS_FOR_OBJECTS_METADATA_TYPE,
          dirName: 'topicsForObjects',
          suffix: 'topicsForObjects',
        } as MetadataTypeAnnotations)
      })
    })

    describe('onDeploy', () => {
      beforeAll(async () => {
        await filter.onDeploy(changes)
      })
      it('should remove topics instance changes', () => {
        expect(changes).toHaveLength(4)
        expect(changes.filter(isInstanceChange)).toHaveLength(0)
      })
    })
  })
})
