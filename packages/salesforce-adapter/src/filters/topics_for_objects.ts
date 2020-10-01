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
  ObjectType, Element, Values, getAnnotationValue, isObjectTypeChange, InstanceElement,
  isAdditionOrModificationChange, getChangeElement, isAdditionChange, isModificationChange,
  ElemID, toChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { TOPICS_FOR_OBJECTS_FIELDS, TOPICS_FOR_OBJECTS_ANNOTATION, TOPICS_FOR_OBJECTS_METADATA_TYPE, SALESFORCE } from '../constants'
import { isCustomObject, apiName, metadataType, createInstanceElement, metadataAnnotationTypes, MetadataTypeAnnotations } from '../transformers/transformer'
import { FilterCreator, FilterWith } from '../filter'
import { TopicsForObjectsInfo } from '../client/types'
import { boolValue, getInstancesOfMetadataType, isInstanceOfTypeChange } from './utils'

const { ENABLE_TOPICS, ENTITY_API_NAME } = TOPICS_FOR_OBJECTS_FIELDS

export const DEFAULT_ENABLE_TOPICS_VALUE = false

const getTopicsForObjects = (obj: ObjectType): Values => getAnnotationValue(obj,
  TOPICS_FOR_OBJECTS_ANNOTATION)

const setTopicsForObjects = (object: ObjectType, enableTopics: boolean): void => {
  object.annotate({ [TOPICS_FOR_OBJECTS_ANNOTATION]: { [ENABLE_TOPICS]: enableTopics } })
}

const setDefaultTopicsForObjects = (object: ObjectType): void => setTopicsForObjects(object,
  DEFAULT_ENABLE_TOPICS_VALUE)

const createTopicsForObjectsInstance = (values: TopicsForObjectsInfo): InstanceElement => (
  createInstanceElement(
    values,
    new ObjectType({
      elemID: new ElemID(SALESFORCE, TOPICS_FOR_OBJECTS_METADATA_TYPE),
      annotationTypes: _.clone(metadataAnnotationTypes),
      annotations: {
        metadataType: TOPICS_FOR_OBJECTS_METADATA_TYPE,
        dirName: 'topicsForObjects',
        suffix: 'topicsForObjects',
      } as MetadataTypeAnnotations,
    })
  )
)

const filterCreator: FilterCreator = (): FilterWith<'onFetch' | 'onDeploy'> => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const customObjectTypes = elements.filter(isCustomObject)
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

    // Remove TopicsForObjects Instances & Type to avoid information duplication
    _.remove(elements, elem => (metadataType(elem) === TOPICS_FOR_OBJECTS_METADATA_TYPE))
  },

  preDeploy: async changes => {
    const customObjectChanges = changes
      .filter(isObjectTypeChange)
      .filter(isAdditionOrModificationChange)
      .filter(change => isCustomObject(getChangeElement(change)))

    const newObjects = customObjectChanges
      .filter(isAdditionChange)
      .map(getChangeElement)
    // Add default value for new custom objects that have not specified a value
    newObjects
      .filter(obj => _.isEmpty(getTopicsForObjects(obj)))
      .forEach(setDefaultTopicsForObjects)

    const newObjectTopicsToSet = newObjects
      .filter(obj => getTopicsForObjects(obj)[ENABLE_TOPICS] !== DEFAULT_ENABLE_TOPICS_VALUE)

    const changedObjectTopics = customObjectChanges
      .filter(isModificationChange)
      .filter(change => (
        getTopicsForObjects(change.data.before) !== getTopicsForObjects(change.data.after)
      ))
      .map(getChangeElement)

    const topicsToSet = [...newObjectTopicsToSet, ...changedObjectTopics]
    if (topicsToSet.length === 0) {
      return
    }

    // Add topics for objects instances to the list of changes to deploy
    changes.push(
      ...topicsToSet
        .map(obj => {
          const topics = getTopicsForObjects(obj)
          const topicsEnabled = boolValue(topics[ENABLE_TOPICS] ?? false)
          return new TopicsForObjectsInfo(apiName(obj), apiName(obj), topicsEnabled)
        })
        .map(createTopicsForObjectsInstance)
        .map(after => toChange({ after }))
    )
  },

  onDeploy: async changes => {
    // Remove all the topics for objects instance changes that we added in preDeploy
    _.remove(changes, isInstanceOfTypeChange(TOPICS_FOR_OBJECTS_METADATA_TYPE))
    return []
  },
})

export default filterCreator
