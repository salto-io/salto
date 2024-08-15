/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
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
import { MetadataTypeAnnotations } from '../../src/transformers/transformer'
import * as constants from '../../src/constants'
import filterCreator from '../../src/filters/topics_for_objects'
import { defaultFilterContext, emptyLastChangeDateOfTypesWithNestedInstances } from '../utils'
import { FilterWith } from './mocks'
import { isInstanceOfTypeChangeSync, isInstanceOfTypeSync } from '../../src/filters/utils'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'
import { buildMetadataQueryForFetchWithChangesDetection } from '../../src/fetch_profile/metadata_query'
import { mockInstances } from '../mock_elements'

const { TOPICS_FOR_OBJECTS_ANNOTATION, TOPICS_FOR_OBJECTS_FIELDS, TOPICS_FOR_OBJECTS_METADATA_TYPE } = constants
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
    const mockTopicElemID = new ElemID(constants.SALESFORCE, constants.TOPICS_FOR_OBJECTS_ANNOTATION)

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
      topicsForObjectsInstance = new InstanceElement('Test__c', topicsForObjectsMetadataType, {
        [ENABLE_TOPICS]: 'true',
        [ENTITY_API_NAME]: 'Test__c',
        [constants.INSTANCE_FULL_NAME_FIELD]: 'Test__c',
      })
      topicsForObjectsType = mockObject('Test__c')
      elements = [topicsForObjectsType, topicsForObjectsInstance, topicsForObjectsMetadataType]
    })
    it('should add topicsForObjects to object types and remove topics type & instances', async () => {
      await filter.onFetch(elements)
      expect(topicsForObjectsType).toSatisfy(
        type => type.annotations[TOPICS_FOR_OBJECTS_ANNOTATION][ENABLE_TOPICS] === true,
      )

      // Check topic instances are deleted and the TopicsForObjects metadataType is hidden
      expect(elements).not.toSatisfy(isInstanceOfTypeSync(TOPICS_FOR_OBJECTS_METADATA_TYPE))
      expect(topicsForObjectsMetadataType).toSatisfy(type => type.annotations[CORE_ANNOTATIONS.HIDDEN] === true)
    })
    describe('when is fetch with changes detection mode', () => {
      const TYPE_WITH_NON_MODIFIED_TOPICS_FOR_OBJECTS = 'Test2__c'

      let typeWithNonModifiedTopicsForObjects: ObjectType

      beforeEach(async () => {
        typeWithNonModifiedTopicsForObjects = mockObject(TYPE_WITH_NON_MODIFIED_TOPICS_FOR_OBJECTS, true)
        const typeInSource = typeWithNonModifiedTopicsForObjects.clone({
          annotations: {
            [TOPICS_FOR_OBJECTS_ANNOTATION]: { [ENABLE_TOPICS]: true },
          },
        })
        const elementsSource = buildElementsSourceFromElements([typeInSource, mockInstances().ChangedAtSingleton])
        filter = filterCreator({
          config: {
            ...defaultFilterContext,
            fetchProfile: buildFetchProfile({
              fetchParams: {},
              metadataQuery: await buildMetadataQueryForFetchWithChangesDetection({
                fetchParams: {},
                elementsSource,
                lastChangeDateOfTypesWithNestedInstances: emptyLastChangeDateOfTypesWithNestedInstances(),
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
          type => type.annotations[TOPICS_FOR_OBJECTS_ANNOTATION][ENABLE_TOPICS] === true,
        )
        expect(typeWithNonModifiedTopicsForObjects).toSatisfy(
          type => type.annotations[TOPICS_FOR_OBJECTS_ANNOTATION][ENABLE_TOPICS] === true,
        )

        // Check topic instances are deleted and the TopicsForObjects metadataType is hidden
        expect(elements).not.toSatisfy(isInstanceOfTypeSync(TOPICS_FOR_OBJECTS_METADATA_TYPE))
        expect(topicsForObjectsMetadataType).toSatisfy(type => type.annotations[CORE_ANNOTATIONS.HIDDEN] === true)
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
        expect(elements).not.toSatisfyAny(isInstanceOfTypeSync(TOPICS_FOR_OBJECTS_METADATA_TYPE))
        expect(topicsForObjectsMetadataType).toSatisfy(type => type.annotations[CORE_ANNOTATIONS.HIDDEN] === true)
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
          toChange({
            before: mockObject('Test5__c'),
            after: mockObject('Test5__c', false),
          }),
        ]
        await filter.preDeploy(changes)
      })
      it('should add topics annotation to new types that do not have it', () => {
        expect(getChangeData(changes[0]).annotations).toHaveProperty(TOPICS_FOR_OBJECTS_ANNOTATION, {
          [ENABLE_TOPICS]: false,
        })
      })
      it('should not add topics to existing types that do not have it', () => {
        expect(getChangeData(changes[3]).annotations).not.toHaveProperty(TOPICS_FOR_OBJECTS_ANNOTATION)
      })
      it('should add topic instance changes with a valid metadata type', () => {
        const topicInstanceChange = changes.find(isInstanceOfTypeChangeSync(TOPICS_FOR_OBJECTS_METADATA_TYPE))
        expect(topicInstanceChange).toBeDefined()
        const topicInstance = getChangeData(topicInstanceChange as Change<InstanceElement>)
        expect(topicInstance.getTypeSync().annotations).toMatchObject({
          metadataType: TOPICS_FOR_OBJECTS_METADATA_TYPE,
          dirName: 'topicsForObjects',
          suffix: 'topicsForObjects',
        } as MetadataTypeAnnotations)
      })
      it('should add topic instance change for new types that have topics enabled', () => {
        expect(changes).toContainEqual(
          expect.objectContaining({
            action: 'add',
            data: expect.objectContaining({
              after: expect.objectContaining({
                value: expect.objectContaining({
                  enableTopics: true,
                  entityApiName: 'Test2__c',
                  fullName: 'Test2__c',
                }),
              }),
            }),
          }),
        )
      })
      it('should add topic instance change for types that had the annotation value changed', () => {
        expect(changes).toContainEqual(
          expect.objectContaining({
            data: expect.objectContaining({
              after: expect.objectContaining({
                value: expect.objectContaining({
                  enableTopics: false,
                  entityApiName: 'Test3__c',
                  fullName: 'Test3__c',
                }),
              }),
            }),
          }),
        )
      })
      it('should not add topic instance for new types that do not have topics enabled', () => {
        expect(changes).not.toContainEqual(
          expect.objectContaining({
            data: expect.objectContaining({
              after: expect.objectContaining({
                value: expect.objectContaining({
                  entityApiName: 'Test1__c',
                  fullName: 'Test1__c',
                }),
              }),
            }),
          }),
        )
      })
      it('should not add topic instance for types where the value did not semantically change', () => {
        expect(changes).not.toContainEqual(
          expect.objectContaining({
            data: expect.objectContaining({
              after: expect.objectContaining({
                value: expect.objectContaining({
                  entityApiName: 'Test5__c',
                  fullName: 'Test5__c',
                }),
              }),
            }),
          }),
        )
      })
    })

    describe('onDeploy', () => {
      beforeAll(async () => {
        await filter.onDeploy(changes)
      })
      it('should remove topics instance changes', () => {
        expect(changes.filter(isInstanceChange)).toHaveLength(0)
      })
    })
  })
})
