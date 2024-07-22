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
  ObjectType,
  Element,
  Values,
  isObjectTypeChange,
  InstanceElement,
  isAdditionOrModificationChange,
  getChangeData,
  isAdditionChange,
  isModificationChange,
  ElemID,
  toChange,
  CORE_ANNOTATIONS,
  ReadOnlyElementsSource,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections, multiIndex, promises } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import {
  TOPICS_FOR_OBJECTS_FIELDS,
  TOPICS_FOR_OBJECTS_ANNOTATION,
  TOPICS_FOR_OBJECTS_METADATA_TYPE,
  SALESFORCE,
} from '../constants'
import {
  isCustomObject,
  apiName,
  createInstanceElement,
  metadataAnnotationTypes,
  MetadataTypeAnnotations,
  isMetadataObjectType,
} from '../transformers/transformer'
import { LocalFilterCreator } from '../filter'
import { TopicsForObjectsInfo } from '../client/types'
import {
  apiNameSync,
  boolValue,
  getInstancesOfMetadataType,
  isCustomObjectSync,
  isInstanceOfTypeChange,
} from './utils'

const { awu } = collections.asynciterable
const { removeAsync } = promises.array
const { ENABLE_TOPICS, ENTITY_API_NAME } = TOPICS_FOR_OBJECTS_FIELDS

const log = logger(module)

export const DEFAULT_ENABLE_TOPICS_VALUE = false

const getTopicsForObjects = (obj: ObjectType): Values =>
  obj.annotations[TOPICS_FOR_OBJECTS_ANNOTATION] || {}

const setTopicsForObjects = (
  object: ObjectType,
  enableTopics: boolean,
): void => {
  object.annotate({
    [TOPICS_FOR_OBJECTS_ANNOTATION]: { [ENABLE_TOPICS]: enableTopics },
  })
}

const setDefaultTopicsForObjects = (object: ObjectType): void =>
  setTopicsForObjects(object, DEFAULT_ENABLE_TOPICS_VALUE)

const createTopicsForObjectsInstance = (
  values: TopicsForObjectsInfo,
): InstanceElement =>
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
    }),
  )

type CustomObjectWithTopics = ObjectType & {
  annotations: {
    [TOPICS_FOR_OBJECTS_ANNOTATION]: {
      [ENABLE_TOPICS]: boolean
    }
  }
}

const isCustomObjectWithTopics = (
  element: Element,
): element is CustomObjectWithTopics =>
  isCustomObjectSync(element) &&
  _.isBoolean(getTopicsForObjects(element)[ENABLE_TOPICS])

type SetTopicsForObjectsForFetchWithChangesDetectionParams = {
  customObjects: ObjectType[]
  isTopicsEnabledByType: Record<string, boolean>
  elementsSource: ReadOnlyElementsSource
}

// In fetch with changes detection mode we won't have the TopicsForObjects instances that
// were not updated from the previous fetch, hence we need the current value from the Elements Source.
const setTopicsForObjectsForFetchWithChangesDetection = async ({
  customObjects,
  isTopicsEnabledByType,
  elementsSource,
}: SetTopicsForObjectsForFetchWithChangesDetectionParams): Promise<void> => {
  if (Object.keys(isTopicsEnabledByType).length > 0) {
    log.debug(
      'isTopicsEnabledByType in fetchWithChangesDetection: %o',
      isTopicsEnabledByType,
    )
  }
  const isTopicsEnabledForObjectFromSource = await multiIndex.keyByAsync({
    iter: await elementsSource.getAll(),
    filter: isCustomObjectWithTopics,
    key: (obj) => [apiNameSync(obj) ?? ''],
    map: (obj) => obj.annotations.topicsForObjects.enableTopics,
  })
  customObjects.forEach((customObject) => {
    const typeApiName = apiNameSync(customObject)
    if (typeApiName === undefined) {
      return
    }
    const isTopicsEnabled =
      isTopicsEnabledByType[typeApiName] !== undefined
        ? isTopicsEnabledByType[typeApiName]
        : isTopicsEnabledForObjectFromSource.get(typeApiName)
    if (isTopicsEnabled === undefined) {
      log.error(
        'expected isTopicsEnabled to be defined in Elements source or have a corresponding TopicsForObjects Instance for type %s',
        typeApiName,
      )
      return
    }
    setTopicsForObjects(customObject, isTopicsEnabled)
  })
}

const filterCreator: LocalFilterCreator = ({ config }) => ({
  name: 'topicsForObjectsFilter',
  onFetch: async (elements: Element[]): Promise<void> => {
    if (
      !config.fetchProfile.metadataQuery.isTypeMatch(
        TOPICS_FOR_OBJECTS_METADATA_TYPE,
      )
    ) {
      log.debug(
        'skipping topicsForObjectsFilter since the MetadataType TopicsForObjects is excluded',
      )
      return
    }
    const topicsForObjectsInstances = await getInstancesOfMetadataType(
      elements,
      TOPICS_FOR_OBJECTS_METADATA_TYPE,
    )
    const topicsForObjectsType = elements
      .filter(isMetadataObjectType)
      .find((type) => apiNameSync(type) === TOPICS_FOR_OBJECTS_METADATA_TYPE)
    const removeTopicsForObjectInstancesAndHideTheirType = (): void => {
      _.pullAll(elements, topicsForObjectsInstances)
      if (topicsForObjectsType === undefined) {
        log.warn('expected TopicsForObjects type to be defined')
        return
      }
      topicsForObjectsType.annotations[CORE_ANNOTATIONS.HIDDEN] = true
    }
    const customObjectTypes = (await awu(elements)
      .filter(isCustomObject)
      .toArray()) as ObjectType[]
    if (_.isEmpty(customObjectTypes)) {
      removeTopicsForObjectInstancesAndHideTheirType()
      return
    }
    const topicsPerObject = topicsForObjectsInstances.map((instance) => ({
      [instance.value[ENTITY_API_NAME]]: boolValue(
        instance.value[ENABLE_TOPICS],
      ),
    }))
    const topics: Record<string, boolean> = _.merge({}, ...topicsPerObject)

    // Add topics for objects to all fetched elements
    if (config.fetchProfile.metadataQuery.isFetchWithChangesDetection()) {
      await setTopicsForObjectsForFetchWithChangesDetection({
        customObjects: customObjectTypes,
        isTopicsEnabledByType: topics,
        elementsSource: config.elementsSource,
      })
    } else {
      await awu(customObjectTypes).forEach(async (obj) => {
        const fullName = await apiName(obj)
        if (Object.keys(topics).includes(fullName)) {
          setTopicsForObjects(obj, topics[fullName])
        }
      })
    }
    removeTopicsForObjectInstancesAndHideTheirType()
  },

  preDeploy: async (changes) => {
    const customObjectChanges = await awu(changes)
      .filter(isObjectTypeChange)
      .filter(isAdditionOrModificationChange)
      .filter((change) => isCustomObject(getChangeData(change)))
      .toArray()

    const newObjects = customObjectChanges
      .filter(isAdditionChange)
      .map(getChangeData)
    // Add default value for new custom objects that have not specified a value
    newObjects
      .filter((obj) => _.isEmpty(getTopicsForObjects(obj)))
      .forEach(setDefaultTopicsForObjects)

    const newObjectTopicsToSet = newObjects.filter(
      (obj) =>
        getTopicsForObjects(obj)[ENABLE_TOPICS] !== DEFAULT_ENABLE_TOPICS_VALUE,
    )

    const changedObjectTopics = customObjectChanges
      .filter(isModificationChange)
      .filter(
        (change) =>
          !_.isEqual(
            getTopicsForObjects(change.data.before),
            getTopicsForObjects(change.data.after),
          ),
      )
      .map(getChangeData)

    const topicsToSet = [...newObjectTopicsToSet, ...changedObjectTopics]
    if (topicsToSet.length === 0) {
      return
    }

    // Add topics for objects instances to the list of changes to deploy
    changes.push(
      ...(await awu(topicsToSet)
        .map(async (obj) => {
          const topics = getTopicsForObjects(obj)
          const topicsEnabled = boolValue(topics[ENABLE_TOPICS] ?? false)
          return new TopicsForObjectsInfo(
            await apiName(obj),
            await apiName(obj),
            topicsEnabled,
          )
        })
        .map(createTopicsForObjectsInstance)
        .map((after) => toChange({ after }))
        .toArray()),
    )
  },

  onDeploy: async (changes) => {
    // Remove all the topics for objects instance changes that we added in preDeploy
    await removeAsync(
      changes,
      isInstanceOfTypeChange(TOPICS_FOR_OBJECTS_METADATA_TYPE),
    )
  },
})

export default filterCreator
