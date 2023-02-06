/*
*                      Copyright 2023 Salto Labs Ltd.
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
  ObjectType, Element, Values, isObjectTypeChange, InstanceElement,
  isAdditionOrModificationChange, getChangeData, isAdditionChange, isModificationChange,
  ElemID, toChange,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections, promises } from '@salto-io/lowerdash'
import { TOPICS_FOR_OBJECTS_FIELDS, TOPICS_FOR_OBJECTS_ANNOTATION, TOPICS_FOR_OBJECTS_METADATA_TYPE, SALESFORCE } from '../constants'
import { isCustomObject, apiName, metadataType, createInstanceElement, metadataAnnotationTypes, MetadataTypeAnnotations } from '../transformers/transformer'
import { LocalFilterCreator, FilterWith } from '../filter'
import { TopicsForObjectsInfo } from '../client/types'
import { boolValue, getInstancesOfMetadataType, isInstanceOfTypeChange } from './utils'

const { awu } = collections.asynciterable
const { removeAsync } = promises.array

const { ENABLE_TOPICS, ENTITY_API_NAME } = TOPICS_FOR_OBJECTS_FIELDS

export const DEFAULT_ENABLE_TOPICS_VALUE = false

const getTopicsForObjects = (obj: ObjectType): Values =>
  obj.annotations[TOPICS_FOR_OBJECTS_ANNOTATION] || {}

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
      annotationRefsOrTypes: _.clone(metadataAnnotationTypes),
      annotations: {
        metadataType: TOPICS_FOR_OBJECTS_METADATA_TYPE,
        dirName: 'topicsForObjects',
        suffix: 'topicsForObjects',
      } as MetadataTypeAnnotations,
    })
  )
)

const filterCreator: LocalFilterCreator = (): FilterWith<'onFetch' | 'onDeploy'> => ({
  name: 'topicsForObjectsFilter',
  onFetch: async (elements: Element[]): Promise<void> => {
    const customObjectTypes = await awu(elements).filter(isCustomObject).toArray() as ObjectType[]
    if (_.isEmpty(customObjectTypes)) {
      return
    }

    const topicsForObjectsInstances = await getInstancesOfMetadataType(elements,
      TOPICS_FOR_OBJECTS_METADATA_TYPE)
    if (_.isEmpty(topicsForObjectsInstances)) {
      return
    }

    const topicsPerObject = topicsForObjectsInstances.map(instance =>
      ({ [instance.value[ENTITY_API_NAME]]: boolValue(instance.value[ENABLE_TOPICS]) }))
    const topics: Record<string, boolean> = _.merge({}, ...topicsPerObject)

    // Add topics for objects to all fetched elements
    await awu(customObjectTypes).forEach(async obj => {
      const fullName = await apiName(obj)
      if (Object.keys(topics).includes(fullName)) {
        setTopicsForObjects(obj, topics[fullName])
      }
    })

    // Remove TopicsForObjects Instances & Type to avoid information duplication
    await removeAsync(
      elements,
      async elem => (await metadataType(elem) === TOPICS_FOR_OBJECTS_METADATA_TYPE)
    )
  },

  preDeploy: async changes => {
    const customObjectChanges = await awu(changes)
      .filter(isObjectTypeChange)
      .filter(isAdditionOrModificationChange)
      .filter(change => isCustomObject(getChangeData(change)))
      .toArray()

    const newObjects = customObjectChanges
      .filter(isAdditionChange)
      .map(getChangeData)
    // Add default value for new custom objects that have not specified a value
    newObjects
      .filter(obj => _.isEmpty(getTopicsForObjects(obj)))
      .forEach(setDefaultTopicsForObjects)

    const newObjectTopicsToSet = newObjects
      .filter(obj => getTopicsForObjects(obj)[ENABLE_TOPICS] !== DEFAULT_ENABLE_TOPICS_VALUE)

    const changedObjectTopics = customObjectChanges
      .filter(isModificationChange)
      .filter(change => (
        !_.isEqual(getTopicsForObjects(change.data.before), getTopicsForObjects(change.data.after))
      ))
      .map(getChangeData)

    const topicsToSet = [...newObjectTopicsToSet, ...changedObjectTopics]
    if (topicsToSet.length === 0) {
      return
    }

    // Add topics for objects instances to the list of changes to deploy
    changes.push(
      ...await awu(topicsToSet)
        .map(async obj => {
          const topics = getTopicsForObjects(obj)
          const topicsEnabled = boolValue(topics[ENABLE_TOPICS] ?? false)
          return new TopicsForObjectsInfo(await apiName(obj), await apiName(obj), topicsEnabled)
        })
        .map(createTopicsForObjectsInstance)
        .map(after => toChange({ after }))
        .toArray()
    )
  },

  onDeploy: async changes => {
    // Remove all the topics for objects instance changes that we added in preDeploy
    await removeAsync(changes, isInstanceOfTypeChange(TOPICS_FOR_OBJECTS_METADATA_TYPE))
  },
})

export default filterCreator
