/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { collections } from '@salto-io/lowerdash'
import { fetch as fetchUtils, definitions as definitionsUtils } from '@salto-io/adapter-components'
import {
  AdditionChange,
  InstanceElement,
  isAdditionChange,
  isReferenceExpression,
  ModificationChange,
  ElemID,
} from '@salto-io/adapter-api'
import { Options } from '../../definitions/types'

const { makeArray } = collections.array

export type ChildParentRelationship = {
  parent: string
  child: string
  fieldName: string
}

const ADDITIONAL_CHILD_PARENT_RELATIONSHIPS: ChildParentRelationship[] = [
  { parent: 'macro', child: 'macro_attachment', fieldName: 'attachments' },
  { parent: 'brand', child: 'brand_logo', fieldName: 'logo' },
  { parent: 'article', child: 'article_attachment', fieldName: 'attachments' },
]

const getParentToStandaloneFields = (
  definitions: definitionsUtils.ApiDefinitions<Options>,
): Record<string, string[]> => {
  const defQuery = definitionsUtils.queryWithDefault(definitions.fetch?.instances ?? {})
  const allDefs = defQuery.getAll()
  const parentToStandaloneMap = Object.entries(allDefs).reduce<Record<string, string[]>>(
    (currentRecord, [typeName, def]) => {
      const fieldCustomizations = def.element?.fieldCustomizations
      if (fieldCustomizations === undefined) {
        return currentRecord
      }
      const standaloneFields = Object.keys(_.pickBy(fieldCustomizations, field => field.standalone))
      if (_.isEmpty(standaloneFields)) {
        return currentRecord
      }
      return {
        ...currentRecord,
        [typeName]: standaloneFields,
      }
    },
    {},
  )

  return parentToStandaloneMap
}

export const getChildAndParentTypeNames = (
  definitions: definitionsUtils.ApiDefinitions<Options>,
): ChildParentRelationship[] => {
  const defQuery = definitionsUtils.queryWithDefault(definitions.fetch?.instances ?? {})
  const parentToStandaloneMap = getParentToStandaloneFields(definitions)
  const parentTypes = Object.keys(parentToStandaloneMap)
  return parentTypes
    .flatMap(parentType => {
      const fields = parentToStandaloneMap[parentType] ?? []
      return fields.map(field => {
        const fullChildTypeName = fetchUtils.element.toNestedTypeName(parentType, field)
        const childTypeName =
          defQuery.query(parentType)?.element?.fieldCustomizations?.[field]?.standalone?.typeName ?? fullChildTypeName
        return { parent: parentType, child: childTypeName, fieldName: field }
      })
    })
    .concat(ADDITIONAL_CHILD_PARENT_RELATIONSHIPS)
}

const getIdsFromReferenceExpressions = (values: unknown): ElemID[] =>
  makeArray(values)
    .filter(isReferenceExpression)
    .map(ref => ref.elemID)

export const getRemovedAndAddedChildren = (
  change: ModificationChange<InstanceElement> | AdditionChange<InstanceElement>,
  fieldName: string,
): { removed: ElemID[]; added: ElemID[] } => {
  const childrenBefore = isAdditionChange(change)
    ? []
    : getIdsFromReferenceExpressions(change.data.before.value[fieldName])
  const childrenAfter = getIdsFromReferenceExpressions(change.data.after.value[fieldName])
  const childrenBeforeLookup = new Set(childrenBefore.map(id => id.getFullName()))
  const childrenAfterLookup = new Set(childrenAfter.map(id => id.getFullName()))
  return {
    removed: childrenBefore.filter(child => !childrenAfterLookup.has(child.getFullName())),
    added: childrenAfter.filter(child => !childrenBeforeLookup.has(child.getFullName())),
  }
}
