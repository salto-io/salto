/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { ObjectType, ElemID, InstanceElement, isObjectType, BuiltinTypes, toChange, Change, getChangeElement, isInstanceChange } from '@salto-io/adapter-api'
import { createRefToElmWithValue } from '@salto-io/adapter-utils'
import { metadataType, apiName, MetadataTypeAnnotations } from '../../src/transformers/transformer'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'
import filterCreator from '../../src/filters/topics_for_objects'
import { buildFetchProfile } from '../../src/fetch_profile/fetch_profile'

const { TOPICS_FOR_OBJECTS_ANNOTATION, TOPICS_FOR_OBJECTS_FIELDS,
  TOPICS_FOR_OBJECTS_METADATA_TYPE } = constants
const { ENABLE_TOPICS, ENTITY_API_NAME } = TOPICS_FOR_OBJECTS_FIELDS

describe('Topics for objects filter', () => {
  const { client } = mockClient()
  const mockTopicElemID = new ElemID(constants.SALESFORCE, constants.TOPICS_FOR_OBJECTS_ANNOTATION)
  const mockObject = (name: string, withTopics?: boolean): ObjectType => new ObjectType({
    elemID: new ElemID(constants.SALESFORCE, name),
    annotations: {
      label: 'test label',
      [constants.API_NAME]: name,
      [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
      ...withTopics === undefined
        ? {}
        : { [TOPICS_FOR_OBJECTS_ANNOTATION]: { [ENABLE_TOPICS]: withTopics } },
    },
  })

  const mockTopic = new ObjectType({
    elemID: mockTopicElemID,
    fields: {
      [ENABLE_TOPICS]: { refType: createRefToElmWithValue(BuiltinTypes.BOOLEAN) },
      [ENTITY_API_NAME]: { refType: createRefToElmWithValue(BuiltinTypes.STRING) },
      [constants.INSTANCE_FULL_NAME_FIELD]: {
        refType: createRefToElmWithValue(BuiltinTypes.SERVICE_ID),
      },
    },
    annotationRefsOrTypes: {},
    annotations: {
      [constants.METADATA_TYPE]: TOPICS_FOR_OBJECTS_METADATA_TYPE,
    },
  })
  const mockTopicForObject = new InstanceElement('Test__c',
    mockTopic,
    {
      [ENABLE_TOPICS]: 'true',
      [ENTITY_API_NAME]: 'Test__c',
      [constants.INSTANCE_FULL_NAME_FIELD]: 'Test__c',
    })

  let filter: FilterWith<'onFetch' | 'preDeploy' | 'onDeploy'>

  describe('onFetch', () => {
    beforeAll(() => {
      filter = filterCreator({
        client,
        config: { fetchProfile: buildFetchProfile({}) },
      }) as typeof filter
    })
    it('should add topicsForObjects to object types and remove topics type & instances', async () => {
      const elements = [mockObject('Test__c'), mockTopicForObject, mockTopic]
      await filter.onFetch(elements)
      const objectTypes = elements.filter(isObjectType)

      // Check mockObject has the topic enables
      const topicForObject = objectTypes[0].annotations[TOPICS_FOR_OBJECTS_ANNOTATION]
      expect(topicForObject[ENABLE_TOPICS]).toBeTruthy()

      // Check topic instances' and type were deleted
      expect(elements
        .filter(elem => metadataType(elem) === TOPICS_FOR_OBJECTS_METADATA_TYPE)).toHaveLength(0)
    })
  })

  describe('preDeploy and onDeploy', () => {
    let changes: Change[]
    beforeAll(() => {
      filter = filterCreator({
        client,
        config: { fetchProfile: buildFetchProfile({}) },
      }) as typeof filter
    })
    describe('preDeploy', () => {
      beforeAll(async () => {
        changes = [
          toChange({ after: mockObject('Test1__c') }),
          toChange({ after: mockObject('Test2__c', true) }),
          toChange({ before: mockObject('Test3__c', true), after: mockObject('Test3__c', false) }),
          toChange({ before: mockObject('Test4__c'), after: mockObject('Test4__c') }),
        ]
        await filter.preDeploy(changes)
      })
      it('should add topics annotation to new types that do not have it', () => {
        expect(getChangeElement(changes[0]).annotations).toHaveProperty(
          TOPICS_FOR_OBJECTS_ANNOTATION,
          { [ENABLE_TOPICS]: false },
        )
      })
      it('should not add topics to existing types that do not have it', () => {
        expect(getChangeElement(changes[3]).annotations).not.toHaveProperty(
          TOPICS_FOR_OBJECTS_ANNOTATION
        )
      })
      it('should add instance change to types that have changed topics enabled value', () => {
        expect(changes).toHaveLength(6)
        const topicsInstanceChanges = changes.slice(4)
        expect(topicsInstanceChanges.map(change => change.action)).toEqual(['add', 'add'])
        const instances = topicsInstanceChanges.map(getChangeElement) as InstanceElement[]
        expect(instances.map(inst => apiName(inst))).toEqual(['Test2__c', 'Test3__c'])
        expect(instances.map(inst => inst.value.enableTopics)).toEqual([true, false])

        const topicsForObjectsType = instances[0].getType()
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
