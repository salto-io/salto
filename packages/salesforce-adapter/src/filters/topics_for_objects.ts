import {
  ObjectType, Element, Values, isObjectType, Change, getAnnotationValue,
} from 'adapter-api'
import _ from 'lodash'
import { SaveResult } from 'jsforce'
import { TOPICS_FOR_OBJECTS_FIELDS, TOPICS_FOR_OBJECTS_ANNOTATION, API_NAME,
  TOPICS_FOR_OBJECTS_METADATA_TYPE } from '../constants'
import { isCustomObject, apiName } from '../transformers/transformer'
import { FilterCreator } from '../filter'
import { TopicsForObjectsInfo } from '../client/types'
import { getCustomObjects, boolValue, removeFieldsFromInstanceAndType, getInstancesOfMetadataType } from './utils'

const { ENABLE_TOPICS, ENTITY_API_NAME } = TOPICS_FOR_OBJECTS_FIELDS

export const DEFAULT_ENABLE_TOPICS_VALUE = false

const getTopicsForObjects = (obj: ObjectType): Values => getAnnotationValue(obj,
  TOPICS_FOR_OBJECTS_ANNOTATION)

const setTopicsForObjects = (object: ObjectType, enableTopics: boolean): void => {
  object.annotate({ [TOPICS_FOR_OBJECTS_ANNOTATION]: { [ENABLE_TOPICS]: enableTopics } })
}

const setDefaultTopicsForObjects = (object: ObjectType): void => setTopicsForObjects(object,
  DEFAULT_ENABLE_TOPICS_VALUE)

const filterCreator: FilterCreator = ({ client }) => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const customObjectTypes = getCustomObjects(elements).filter(obj => obj.annotations[API_NAME])
    if (_.isEmpty(customObjectTypes)) {
      return
    }

    const topicsForObjectsInstances = getInstancesOfMetadataType(elements,
      TOPICS_FOR_OBJECTS_METADATA_TYPE)
    if (_.isEmpty(topicsForObjectsInstances)) {
      return
    }

    const topicsPerObject = topicsForObjectsInstances.map(instance =>
      ({ [instance.value[ENTITY_API_NAME]]: boolValue(instance.value[ENABLE_TOPICS]) }))
    const topics: Record<string, boolean> = _.merge({}, ...topicsPerObject)

    // Add topics for objects to all fetched elements
    customObjectTypes.forEach(obj => {
      const fullName = apiName(obj)
      if (Object.keys(topics).includes(fullName)) {
        setTopicsForObjects(obj, topics[fullName])
      }
    })

    // Remove enable topic field from TopicsForObjects Instances & Type
    // to avoid information duplication
    removeFieldsFromInstanceAndType(elements, [ENABLE_TOPICS], TOPICS_FOR_OBJECTS_METADATA_TYPE)
  },

  onAdd: async (after: Element): Promise<SaveResult[]> => {
    if (isObjectType(after) && isCustomObject(after)) {
      const topicsForObjects = getTopicsForObjects(after)

      // In case that we add an object with enable_topics that differs from the default -> Adds
      //  a TopicsForObjects with the object' value. Else, Don't send an update request
      if (boolValue(topicsForObjects[ENABLE_TOPICS]) !== DEFAULT_ENABLE_TOPICS_VALUE) {
        return client.update(TOPICS_FOR_OBJECTS_METADATA_TYPE,
          new TopicsForObjectsInfo(apiName(after), apiName(after),
            getTopicsForObjects(after)[ENABLE_TOPICS]))
      }
      if (_.isEmpty(topicsForObjects)) {
        setDefaultTopicsForObjects(after)
      }
    }
    return []
  },

  onUpdate: async (before: Element, after: Element, _changes: ReadonlyArray<Change>):
    Promise<SaveResult[]> => {
    if (!(isObjectType(before) && isObjectType(after) && isCustomObject(before))) {
      return []
    }

    // No change
    const topicsBefore = getTopicsForObjects(before)
    const topicsAfter = getTopicsForObjects(after)
    if (_.isEqual(topicsAfter[ENABLE_TOPICS], topicsBefore[ENABLE_TOPICS])) {
      return []
    }

    // In case that the topicsForObjects doesn't exist anymore -> enable_topics=false
    const topicsEnabled = _.isUndefined(topicsAfter[ENABLE_TOPICS])
      ? false : boolValue(topicsAfter[ENABLE_TOPICS])

    return client.update(TOPICS_FOR_OBJECTS_METADATA_TYPE,
      new TopicsForObjectsInfo(apiName(after), apiName(after), topicsEnabled))
  },
})

export default filterCreator
