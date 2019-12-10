import {
  ObjectType, ElemID, Field,
  InstanceElement, isObjectType, isInstanceElement, BuiltinTypes,
} from 'adapter-api'
import { metadataType } from '../../src/transformers/transformer'
import * as constants from '../../src/constants'
import { FilterWith } from '../../src/filter'
import mockClient from '../client'
import filterCreator, { TOPICS_FOR_OBJECTS_METADATA_TYPE } from '../../src/filters/topics_for_objects'
import { TopicsForObjectsInfo } from '../../src/client/types'

const { TOPICS_FOR_OBJECTS_ANNOTATION, TOPICS_FOR_OBJECTS_FIELDS } = constants
const { ENABLE_TOPICS, ENTITY_API_NAME } = TOPICS_FOR_OBJECTS_FIELDS

describe('Field Permissions filter', () => {
  const { client } = mockClient()
  const mockElemID = new ElemID(constants.SALESFORCE, 'test')
  const mockTopicElemID = new ElemID(constants.SALESFORCE, 'topics_for_objects')
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
      [ENABLE_TOPICS]: new Field(mockTopicElemID, ENABLE_TOPICS, BuiltinTypes.BOOLEAN),
      [ENTITY_API_NAME]: new Field(mockTopicElemID, ENTITY_API_NAME, BuiltinTypes.STRING),
      [constants.INSTANCE_FULL_NAME_FIELD]:
        new Field(mockTopicElemID, constants.INSTANCE_FULL_NAME_FIELD, BuiltinTypes.SERVICE_ID),
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

  let mockUpdate: jest.Mock<unknown>

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

  it('should add topics_for_objects to object types and remove it from topics type & instances',
    async () => {
      const elements = [mockObject.clone(), mockTopicForObject, mockTopic]
      await filter().onFetch(elements)
      const objectTypes = elements.filter(isObjectType)

      // Check mockObject has the topic enables
      const topicForObject = objectTypes[0].annotations[TOPICS_FOR_OBJECTS_ANNOTATION]
      expect(topicForObject[ENABLE_TOPICS]).toBeTruthy()

      // Check topic instances' enable topics were deleted
      elements.filter(isInstanceElement)
        .filter(elem => metadataType(elem) === TOPICS_FOR_OBJECTS_METADATA_TYPE)
        .forEach(topicInstance => expect(topicInstance.value[ENABLE_TOPICS])
          .toBeUndefined())

      // Check TopicForObject type's enable_topics field was deleted
      const topicType = elements.filter(isObjectType)
        .filter(elem => metadataType(elem) === TOPICS_FOR_OBJECTS_METADATA_TYPE)[0]
      expect(topicType).toBeDefined()
      expect(topicType.fields[ENABLE_TOPICS]).toBeUndefined()
    })

  it('should set default value upon add', async () => {
    const after = mockObject.clone()
    await filter().onAdd(after)

    expect(after.annotations[TOPICS_FOR_OBJECTS_ANNOTATION])
      .toEqual({ [ENABLE_TOPICS]: false })
    verifyUpdateCall('Test__c', false)
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
