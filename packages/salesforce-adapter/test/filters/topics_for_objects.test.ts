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
  ObjectType, ElemID, InstanceElement, isObjectType, BuiltinTypes,
} from '@salto-io/adapter-api'
import { metadataType } from '../../src/transformers/transformer'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'
import filterCreator from '../../src/filters/topics_for_objects'
import { TopicsForObjectsInfo } from '../../src/client/types'

const { TOPICS_FOR_OBJECTS_ANNOTATION, TOPICS_FOR_OBJECTS_FIELDS,
  TOPICS_FOR_OBJECTS_METADATA_TYPE } = constants
const { ENABLE_TOPICS, ENTITY_API_NAME } = TOPICS_FOR_OBJECTS_FIELDS

describe('Field Permissions filter', () => {
  const { client } = mockClient()
  const mockElemID = new ElemID(constants.SALESFORCE, 'test')
  const mockTopicElemID = new ElemID(constants.SALESFORCE, constants.TOPICS_FOR_OBJECTS_ANNOTATION)
  const mockObject = new ObjectType({
    elemID: mockElemID,
    annotations: {
      label: 'test label',
      [constants.API_NAME]: 'Test__c',
      [constants.METADATA_TYPE]: constants.CUSTOM_OBJECT,
    },
  })

  const mockTopic = new ObjectType({
    elemID: mockTopicElemID,
    fields: {
      [ENABLE_TOPICS]: { type: BuiltinTypes.BOOLEAN },
      [ENTITY_API_NAME]: { type: BuiltinTypes.STRING },
      [constants.INSTANCE_FULL_NAME_FIELD]: { type: BuiltinTypes.SERVICE_ID },
    },
    annotationTypes: {},
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

  const enableTopicTrue = { [ENABLE_TOPICS]: true }

  let mockUpdate: jest.Mock

  type FilterType = FilterWith<'onFetch' | 'onAdd' | 'onUpdate'>
  const filter = (): FilterType => filterCreator({ client }) as FilterType

  const verifyUpdateCall = (object: string, enableTopics: boolean): void => {
    expect(mockUpdate.mock.calls.length).toBe(1)
    const topicsForObjects = mockUpdate.mock.calls[0][1] as TopicsForObjectsInfo
    expect(topicsForObjects.enableTopics).toBe(enableTopics)
    expect(topicsForObjects.entityApiName).toBe(object)
  }

  beforeEach(() => {
    mockUpdate = jest.fn().mockImplementationOnce(() => ([{ success: true }]))
    client.update = mockUpdate
  })

  it('should add topicsForObjects to object types and remove topics type & instances',
    async () => {
      const elements = [mockObject.clone(), mockTopicForObject, mockTopic]
      await filter().onFetch(elements)
      const objectTypes = elements.filter(isObjectType)

      // Check mockObject has the topic enables
      const topicForObject = objectTypes[0].annotations[TOPICS_FOR_OBJECTS_ANNOTATION]
      expect(topicForObject[ENABLE_TOPICS]).toBeTruthy()

      // Check topic instances' and type were deleted
      expect(elements
        .filter(elem => metadataType(elem) === TOPICS_FOR_OBJECTS_METADATA_TYPE)).toHaveLength(0)
    })

  it('should set default value upon add', async () => {
    const after = mockObject.clone()
    await filter().onAdd(after)

    expect(after.annotations[TOPICS_FOR_OBJECTS_ANNOTATION])
      .toEqual({ [ENABLE_TOPICS]: false })
    // Verify that no update calls were made
    expect(mockUpdate.mock.calls).toHaveLength(0)
  })

  it('should update topicsForObjects value upon add', async () => {
    const after = mockObject.clone()
    after.annotate({ [TOPICS_FOR_OBJECTS_ANNOTATION]: enableTopicTrue })

    await filter().onAdd(after)

    expect(after.annotations[TOPICS_FOR_OBJECTS_ANNOTATION])
      .toEqual({ [ENABLE_TOPICS]: true })
    verifyUpdateCall('Test__c', true)
  })

  it('should set new value for enable_topics upon update', async () => {
    const before = mockObject.clone()
    const after = before.clone()
    after.annotations[TOPICS_FOR_OBJECTS_ANNOTATION] = enableTopicTrue

    await filter().onUpdate(before, after,
      [{ action: 'modify', data: { before, after } }])

    verifyUpdateCall('Test__c', true)
  })
})
