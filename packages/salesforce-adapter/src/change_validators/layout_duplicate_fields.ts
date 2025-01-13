/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeError,
  ChangeValidator,
  InstanceElement,
  ReferenceExpression,
  getChangeData,
  isInstanceChange,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { values as lowerDashValues } from '@salto-io/lowerdash'
import { LAYOUT_TYPE_ID_METADATA_TYPE } from '../constants'
import { apiNameSync, isInstanceOfTypeSync } from '../filters/utils'

const { isDefined } = lowerDashValues

type LayoutItem = {
  field: string | ReferenceExpression
}

type LayoutColumn = {
  layoutItems: LayoutItem[]
}

type LayoutSection = {
  layoutColumns?: LayoutColumn[]
}

const isLayoutItem = (value: unknown): value is LayoutItem =>
  _.isPlainObject(value) && (_.isString(_.get(value, 'field')) || isReferenceExpression(_.get(value, 'field')))

const isLayoutColumn = (value: unknown): value is LayoutColumn =>
  _.isPlainObject(value) && _.isArray(_.get(value, 'layoutItems')) && _.every(_.get(value, 'layoutItems'), isLayoutItem)

const isLayoutColumns = (value: unknown): value is LayoutColumn[] => _.isArray(value) && _.every(value, isLayoutColumn)

const isLayoutSection = (value: unknown): value is LayoutSection =>
  _.isPlainObject(value) &&
  (_.isUndefined(_.get(value, 'layoutColumns')) || isLayoutColumns(_.get(value, 'layoutColumns')))

const isLayoutSections = (value: unknown): value is LayoutSection[] =>
  _.isArray(value) && _.every(value, isLayoutSection)

const hasDuplicatesFieldError = (
  { elemID }: InstanceElement,
  objectName: string,
  duplicates: string[],
): ChangeError => ({
  elemID,
  severity: 'Error',
  message: 'Layout cannot contain multiple items for the same field',
  detailedMessage: `The ${objectName} has duplicate items for the following fields: ${duplicates}. Please remove the duplicate layout item in order to deploy.`,
})

const getDuplicateFields = (instance: InstanceElement): string[] | undefined => {
  const { layoutSections } = instance.value
  if (!isLayoutSections(layoutSections)) {
    return undefined
  }

  const fields: string[] = layoutSections.flatMap(
    (section: LayoutSection) =>
      section.layoutColumns?.flatMap(
        column =>
          column.layoutItems
            ?.map(item => {
              if (isReferenceExpression(item.field)) {
                return item.field.elemID.getFullName()
              }
              return item.field
            })
            .filter(field => field !== undefined) ?? [],
      ) ?? [],
  )

  const duplicateFields = fields.filter((field, index) => fields.indexOf(field) !== index)
  return duplicateFields.length > 0 ? _.uniq(duplicateFields) : undefined
}

const changeValidator: ChangeValidator = async changes =>
  changes
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(isInstanceOfTypeSync(LAYOUT_TYPE_ID_METADATA_TYPE))
    .map(instance => {
      const duplicates = getDuplicateFields(instance)
      return duplicates ? hasDuplicatesFieldError(instance, apiNameSync(instance) ?? 'Layout', duplicates) : undefined
    })
    .filter(isDefined)

export default changeValidator
