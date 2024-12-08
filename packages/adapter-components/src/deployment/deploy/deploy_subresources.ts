/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import _ from 'lodash'
import {
  Change,
  ElemID,
  getChangeData,
  InstanceElement,
  isEqualValues,
  Values,
  ObjectType,
  CORE_ANNOTATIONS,
  toChange,
  ReferenceExpression,
  isRemovalOrModificationChange,
  isAdditionOrModificationChange,
  isObjectType,
  getDeepInnerTypeSync,
} from '@salto-io/adapter-api'
import { types, collections } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { createCheck } from './requester'
import { ApiDefinitions, APIDefinitionsOptions, queryWithDefault } from '../../definitions'
import { ChangeAndContext } from '../../definitions/system/deploy'

const log = logger(module)
const { makeArray } = collections.array

type getChangeIDFunc = (val: Values, getChangeId?: string[]) => string

/**
 * Returns the type of the sub resource at the given path, as the original type is required for reference resolving.
 * If the type is not found, it returns an empty type with the expected name.
 */
const getSubResourceType = (instance: InstanceElement, path: string[], recurseIntoTypeName: string): ObjectType => {
  const topLevelType = instance.getTypeSync()
  const getTypeInPath = (type: ObjectType | undefined, fieldPath: string[]): ObjectType | undefined => {
    if (type === undefined || fieldPath.length === 0) {
      return type
    }
    const field = type.fields[fieldPath[0]]
    if (!field) {
      log.warn('failed to find type for field %s in type %s', fieldPath[0], type.elemID.getFullName())
      return undefined
    }

    // we currently ignore paths that contains any container types
    const fieldType = getDeepInnerTypeSync(field.getTypeSync())
    // TODOS - handle primitives
    if (!isObjectType(fieldType)) {
      log.warn('field %s in type %s is not an object type', fieldPath[0], type.elemID.getFullName())
      return undefined
    }
    return getTypeInPath(fieldType, path.slice(1))
  }
  const typeInPath = getTypeInPath(topLevelType, path)
  if (typeInPath?.elemID?.name !== recurseIntoTypeName) {
    log.error(
      'type mismatch for path %s in type %s, expected %s, got %s, creating empty type',
      path.join('.'),
      topLevelType.elemID.getFullName(),
      recurseIntoTypeName,
      typeInPath?.elemID?.getFullName(),
    )
    return new ObjectType({
      elemID: new ElemID(topLevelType.elemID.adapter, recurseIntoTypeName),
    })
  }
  return typeInPath
}

/**
 * Creates changes for subresources of a change based on RecurseIntoTypeDef.
 */
export const createChangesForSubResources = async <TOptions extends APIDefinitionsOptions>({
  change,
  definitions,
  context,
}: {
  change: Change<InstanceElement>
  definitions: types.PickyRequired<ApiDefinitions<TOptions>, 'deploy'>
  context: Omit<ChangeAndContext, 'change'>
}): Promise<Change<InstanceElement>[]> => {
  const defQuery = queryWithDefault(definitions.deploy.instances)
  const { recurseIntoTypes } = defQuery.query(getChangeData(change).elemID.typeName) ?? {}
  if (recurseIntoTypes === undefined) {
    return []
  }

  const getChangeIdFunc: getChangeIDFunc = (val, getChangeId) =>
    !Array.isArray(getChangeId) ? String(val) : getChangeId.map(id => _.get(val, id)).join('_')

  const createChangeFromSubResource = (
    item: { id: string; data: { before?: Values; after?: Values } },
    type: ObjectType,
    originalChange: Change<InstanceElement>,
  ): Change<InstanceElement> => {
    // creating a reference, to allow using content added during original change deployment
    const originalChangeRef = new ReferenceExpression(
      getChangeData(originalChange).elemID,
      getChangeData(originalChange).value,
    )
    const beforeInstance =
      item.data.before !== undefined
        ? new InstanceElement(item.id, type, item.data.before, undefined, {
            [CORE_ANNOTATIONS.PARENT]: [originalChangeRef],
          })
        : undefined
    const afterInstance =
      item.data.after !== undefined
        ? new InstanceElement(item.id, type, item.data.after, undefined, {
            [CORE_ANNOTATIONS.PARENT]: [originalChangeRef],
          })
        : undefined
    return toChange({ before: beforeInstance, after: afterInstance })
  }

  const changes: Change<InstanceElement>[] = (
    await Promise.all(
      Object.entries(recurseIntoTypes).map(async ([recurseIntoTypeName, { condition, fieldPath, getChangeId }]) => {
        const checkFunc = createCheck(condition, fieldPath)
        if (!(await checkFunc({ change, ...context, errors: {} }))) {
          log.trace(
            'skipping recurse into %s in type %s for change %s because the condition was not met',
            recurseIntoTypeName,
            getChangeData(change).elemID.typeName,
            getChangeData(change).elemID.getFullName(),
          )
          return []
        }

        const [beforeItems, afterItems] = [
          isRemovalOrModificationChange(change) ? change.data.before : undefined,
          isAdditionOrModificationChange(change) ? change.data.after : undefined,
        ]
          .map(instance => makeArray(_.get(instance?.value, fieldPath)))
          .map(items => items.map(item => ({ id: getChangeIdFunc(item, getChangeId), data: item })))

        const beforeItemsById = _.keyBy(beforeItems, 'id')
        const afterItemsById = _.keyBy(afterItems, 'id')

        const recurseIntoType = getSubResourceType(getChangeData(change), fieldPath, recurseIntoTypeName)

        const additions = Object.entries(afterItemsById)
          .filter(([id]) => beforeItemsById[id] === undefined)
          .map(([id, item]) => createChangeFromSubResource({ id, data: { after: item.data } }, recurseIntoType, change))

        const removals = Object.entries(beforeItemsById)
          .filter(([id]) => afterItemsById[id] === undefined)
          .map(([id, item]) =>
            createChangeFromSubResource({ id, data: { before: item.data } }, recurseIntoType, change),
          )

        const modifications = Object.entries(beforeItemsById)
          .filter(([id, beforeItem]) => {
            const afterItem = afterItemsById[id]
            return afterItem !== undefined && !isEqualValues(beforeItem.data, afterItem.data)
          })
          .map(([id, beforeItem]) =>
            createChangeFromSubResource(
              {
                id,
                data: {
                  before: beforeItem.data,
                  after: afterItemsById[id].data,
                },
              },
              recurseIntoType,
              change,
            ),
          )

        return additions.concat(removals).concat(modifications)
      }),
    )
  ).flat()

  return changes
}
