/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  Change,
  Element,
  ElemID,
  getChangeData,
  InstanceElement,
  isInstanceElement,
  isObjectType,
  ReferenceExpression,
} from '@salto-io/adapter-api'
import { elements as elementsUtils } from '@salto-io/adapter-components'
import { applyFunctionToChangeData, naclCase } from '@salto-io/adapter-utils'
import { collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import _ from 'lodash'
import { ZENDESK, FIELD_TYPE_NAMES, TAG_TYPE_NAME } from '../constants'
import { FilterCreator } from '../filter'
import { isConditions } from './utils'

const log = logger(module)

const RELEVANT_FIELD_NAMES = ['current_tags', 'remove_tags', 'set_tags']
const TYPE_NAME_TO_RELEVANT_FIELD_NAMES_WITH_CONDITIONS: Record<string, string[]> = {
  automation: ['actions', 'conditions.all', 'conditions.any'],
  trigger: ['actions', 'conditions.all', 'conditions.any'],
  view: ['conditions.all', 'conditions.any'],
  macro: ['actions'],
  sla_policy: ['filter.all', 'filter.any'],
  workspace: ['conditions.all', 'conditions.any'],
}
const TYPE_NAME_TO_TAG_FIELD_NAMES: Record<string, string[]> = {
  user_segment: ['tags', 'or_tags'],
}

const TAG_FIELD_NAME_IN_CHECKBOX = 'tag'
const TAGS_FILE_NAME = 'tags'

const { RECORDS_PATH } = elementsUtils
const { awu } = collections.asynciterable

const TAG_SEPERATOR = ' '
const extractTags = (value: string): string[] => value.split(TAG_SEPERATOR).filter(tag => !_.isEmpty(tag))

const isRelevantCheckboxInstance = (instance: InstanceElement): boolean =>
  FIELD_TYPE_NAMES.includes(instance.elemID.typeName) &&
  instance.value.type === 'checkbox' &&
  !_.isEmpty(instance.value[TAG_FIELD_NAME_IN_CHECKBOX])

const isRelevantInstance = (instance: InstanceElement): boolean =>
  Object.keys(TYPE_NAME_TO_RELEVANT_FIELD_NAMES_WITH_CONDITIONS).includes(instance.elemID.typeName) ||
  Object.keys(TYPE_NAME_TO_TAG_FIELD_NAMES).includes(instance.elemID.typeName) ||
  isRelevantCheckboxInstance(instance)

const createTagReferenceExpression = (tag: string): ReferenceExpression =>
  new ReferenceExpression(new ElemID(ZENDESK, TAG_TYPE_NAME, 'instance', naclCase(tag)))

const convertConditionTagFieldsToArray = (instance: InstanceElement): void => {
  ;(TYPE_NAME_TO_RELEVANT_FIELD_NAMES_WITH_CONDITIONS[instance.elemID.typeName] ?? []).forEach(fieldName => {
    const conditions = _.get(instance.value, fieldName)
    if (conditions === undefined || !isConditions(conditions)) {
      return
    }
    conditions.forEach(condition => {
      if (
        _.isString(condition.field) &&
        RELEVANT_FIELD_NAMES.includes(condition.field) &&
        _.isString(condition.value)
      ) {
        condition.value = extractTags(condition.value)
      }
    })
  })
}

const replaceTagsWithReferences = (instance: InstanceElement): string[] => {
  const tags: string[] = []
  ;(TYPE_NAME_TO_RELEVANT_FIELD_NAMES_WITH_CONDITIONS[instance.elemID.typeName] ?? []).forEach(fieldName => {
    const conditions = _.get(instance.value, fieldName)
    if (conditions === undefined || !isConditions(conditions)) {
      return
    }
    conditions.forEach(condition => {
      if (
        _.isString(condition.field) &&
        RELEVANT_FIELD_NAMES.includes(condition.field) &&
        Array.isArray(condition.value) &&
        condition.value.every(_.isString)
      ) {
        condition.value.forEach(tag => {
          tags.push(tag)
        })
        condition.value = condition.value.map(tag => createTagReferenceExpression(tag))
      }
    })
  })
  if (isRelevantCheckboxInstance(instance)) {
    // There should be just one tag in checkbox
    const tag = instance.value[TAG_FIELD_NAME_IN_CHECKBOX]
    tags.push(tag)
    instance.value[TAG_FIELD_NAME_IN_CHECKBOX] = createTagReferenceExpression(tag)
  }
  ;(TYPE_NAME_TO_TAG_FIELD_NAMES[instance.elemID.typeName] ?? []).forEach(fieldName => {
    const value = instance.value[fieldName]
    if (value === undefined || !_.isArray(value) || !value.every(_.isString)) {
      return
    }
    value.forEach(tag => {
      tags.push(tag)
    })
    instance.value[fieldName] = value.map(createTagReferenceExpression)
  })
  return tags
}

const serializeReferencesToTags = (instance: InstanceElement): void => {
  ;(TYPE_NAME_TO_RELEVANT_FIELD_NAMES_WITH_CONDITIONS[instance.elemID.typeName] ?? []).forEach(fieldName => {
    const conditions = _.get(instance.value, fieldName)
    if (conditions === undefined || !isConditions(conditions)) {
      return
    }
    conditions.forEach(condition => {
      if (_.isString(condition.field) && RELEVANT_FIELD_NAMES.includes(condition.field)) {
        if (_.isArray(condition.value) && condition.value.every(_.isString)) {
          condition.value = condition.value.join(TAG_SEPERATOR)
        } else {
          log.warn('Tags values are in invalid format: %o', condition.value)
        }
      }
    })
  })
}

/**
 * Extract tags references from business rules that refers to them
 */
const filterCreator: FilterCreator = ({ fetchQuery }) => ({
  name: 'tagsFilter',
  onFetch: async (elements: Element[]): Promise<void> => {
    const instances = elements.filter(isInstanceElement).filter(isRelevantInstance)

    instances.forEach(convertConditionTagFieldsToArray)
    if (!fetchQuery.isTypeMatch(TAG_TYPE_NAME)) {
      log.debug('tags are excluded, not creating references and instances')
      return
    }
    const tagObjectType = elements.filter(isObjectType).find(t => t.elemID.typeName === TAG_TYPE_NAME)
    if (tagObjectType === undefined) {
      log.error('could not find tag object type')
      return
    }
    const tags = instances.flatMap(instance => replaceTagsWithReferences(instance))
    // the tag object type was created by the config
    const tagInstances = _(tags)
      .uniq()
      .sort()
      .map(
        tag =>
          new InstanceElement(naclCase(tag), tagObjectType, { id: tag }, [
            ZENDESK,
            RECORDS_PATH,
            TAG_TYPE_NAME,
            TAGS_FILE_NAME,
          ]),
      )
      .value()
    // We do this trick to avoid calling push with the spread notation
    tagInstances.forEach(element => {
      elements.push(element)
    })
  },
  // Tag is not an object in Zendesk, and there is no meaning to "deploy" tag
  // Therefore, we created an empty deploy function that always "succeed"
  // We basically don't deploy anything
  deploy: async (changes: Change<InstanceElement>[]) => {
    const [tagsChanges, leftoverChanges] = _.partition(
      changes,
      change => getChangeData(change).elemID.typeName === TAG_TYPE_NAME,
    )
    return { deployResult: { appliedChanges: tagsChanges, errors: [] }, leftoverChanges }
  },
  preDeploy: async (changes: Change<InstanceElement>[]) => {
    const relevantChanges = changes.filter(change => isRelevantInstance(getChangeData(change)))
    if (_.isEmpty(relevantChanges)) {
      return
    }
    await awu(changes).forEach(async change => {
      await applyFunctionToChangeData<Change<InstanceElement>>(change, instance => {
        serializeReferencesToTags(instance)
        return instance
      })
    })
  },
  onDeploy: async (changes: Change<InstanceElement>[]) => {
    const relevantChanges = changes.filter(change =>
      Object.keys(TYPE_NAME_TO_RELEVANT_FIELD_NAMES_WITH_CONDITIONS).includes(getChangeData(change).elemID.typeName),
    )
    if (_.isEmpty(relevantChanges)) {
      return
    }
    const shouldReplaceTags = fetchQuery.isTypeMatch(TAG_TYPE_NAME)
    if (!shouldReplaceTags) {
      log.debug('tags are excluded, not creating references and instances')
    }
    await awu(changes).forEach(async change => {
      await applyFunctionToChangeData<Change<InstanceElement>>(change, instance => {
        convertConditionTagFieldsToArray(instance)
        if (shouldReplaceTags) {
          replaceTagsWithReferences(instance)
        }
        return instance
      })
    })
  },
})

export default filterCreator
