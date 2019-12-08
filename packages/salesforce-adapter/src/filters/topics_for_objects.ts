import {
  ObjectType, Element, Values, isObjectType, isInstanceElement, InstanceElement,
} from 'adapter-api'
import _ from 'lodash'
import { SaveResult } from 'jsforce'
// import wu from 'wu'
import {
  TOPICS_FOR_OBJECTS_FIELDS, TOPICS_FOR_OBJECTS_ANNOTATION,
} from '../constants'
import {
  metadataType, isCustomObject, apiName,
} from '../transformer'
import { FilterCreator } from '../filter'
import { TopicsForObjects, TopicsForObjectsInfo } from '../client/types'
import { getCustomObjects, boolValue } from './utils'

const { ENABLE_TOPICS, ENTITY_API_NAME } = TOPICS_FOR_OBJECTS_FIELDS

export const TOPICS_FOR_OBJECTS_METADATA_TYPE = 'TopicsForObjects'

// --- Utils functions
export const getTopicsForObjects = (object: ObjectType): Values =>
  (object.annotations[TOPICS_FOR_OBJECTS_ANNOTATION] || {})

const setTopicsForObjects = (object: ObjectType, enableTopics: boolean): void => {
  if (_.isEmpty(getTopicsForObjects(object))) {
    object.annotations[TOPICS_FOR_OBJECTS_ANNOTATION] = { [ENABLE_TOPICS]: false }
  }
  if (enableTopics) {
    getTopicsForObjects(object)[ENABLE_TOPICS] = true
  }
}

const setDefaultTopicsForObjects = (object: ObjectType): void => {
  if (_.isEmpty(getTopicsForObjects(object))) {
    setTopicsForObjects(object, false)
  }
}

type ObjectToTopics = Record<string, { enableTopics: boolean; entityApiName: string }>

/**
 * Create a record of { full_name: { enableTopics: boolean, entityApiName: string } }
 * from the topics for objects
 */
const object2Topics = (topicsForObjectInstance: InstanceElement): ObjectToTopics => {
  const instanceTopicsToObjects:
   TopicsForObjects = { enableTopics: topicsForObjectInstance.value[ENABLE_TOPICS],
     entityApiName: topicsForObjectInstance.value[ENTITY_API_NAME] }

  if (!instanceTopicsToObjects) {
    return {}
  }

  return (
    {
      [instanceTopicsToObjects.entityApiName]: {
        enableTopics: boolValue(instanceTopicsToObjects.enableTopics),
        entityApiName: instanceTopicsToObjects.entityApiName,
      },
    })
}
// ---

/**
 * TODO
 * Field permissions filter. Handle the mapping from sobject field FIELD_LEVEL_SECURITY_ANNOTATION
 * annotation and remove Profile.fieldsPermissions.
 */
const filterCreator: FilterCreator = ({ client }) => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const customObjectTypes = getCustomObjects(elements)
    if (_.isEmpty(customObjectTypes)) {
      return
    }
    const topicsForObjectsInstances = elements.filter(isInstanceElement)
      .filter(element => metadataType(element) === TOPICS_FOR_OBJECTS_METADATA_TYPE)
    if (_.isEmpty(topicsForObjectsInstances)) {
      return
    }

    const topicsPerObject = topicsForObjectsInstances.map(object2Topics)
    const topics: ObjectToTopics = _.merge({}, ...topicsPerObject)

    // Add topics for objects to all fetched elements
    customObjectTypes.forEach(obj => {
      const fullName = apiName(obj)
      const topicsToObject = topics[fullName]
      if (topicsToObject) {
        setTopicsForObjects(obj, topicsToObject.enableTopics)
      }
    })

    // Remove field permissions from Profile Instances & Type to avoid information duplication
    topicsForObjectsInstances.forEach(topic => delete topic.value[ENABLE_TOPICS])
    elements.filter(isObjectType)
      .filter(element => metadataType(element) === TOPICS_FOR_OBJECTS_METADATA_TYPE)
      .forEach(topic => delete topic.fields[ENABLE_TOPICS])
  },

  onAdd: async (after: Element): Promise<SaveResult[]> => {
    if (isObjectType(after) && isCustomObject(after)) {
      // Set default permissions for all fields of new object
      setDefaultTopicsForObjects(after)

      return client.update(TOPICS_FOR_OBJECTS_METADATA_TYPE,
        new TopicsForObjectsInfo(apiName(after),
          { entityApiName: apiName(after), enableTopics: false }))
    }
    return []
  },
})

export default filterCreator
