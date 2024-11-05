/*
 * Copyright 2024 Salto Labs Ltd.
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
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { LAYOUT_TYPE_ID_METADATA_TYPE } from '../constants'
import { isInstanceOfTypeSync } from '../filters/utils'

const { awu } = collections.asynciterable

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

const hasDuplicatesFieldError = ({ elemID }: InstanceElement, objectName: string): ChangeError => ({
  elemID,
  severity: 'Error',
  message: 'Layout columns can not duplicate field as layout items',
  detailedMessage: `The ${objectName} contains a layout column with duplicate layout items. Please remove the duplicate layout item in order to deploy.`,
})

const hasDuplicateFields = (instance: InstanceElement): boolean => {
  const layoutSections = instance.value.layoutSections
  if (!isLayoutSections(layoutSections)) {
    return false
  }

  const fields: (string | ReferenceExpression)[] = layoutSections.flatMap(
    (section: LayoutSection) =>
      section.layoutColumns?.flatMap(
        column => column.layoutItems?.map(item => item.field).filter(field => field !== undefined) || [],
      ) || [],
  )

  const uniqueFields = _.uniq(fields)
  return uniqueFields.length !== fields.length
}

const changeValidator: ChangeValidator = async changes =>
  awu(changes)
    .filter(isInstanceChange)
    .map(getChangeData)
    .filter(isInstanceOfTypeSync(LAYOUT_TYPE_ID_METADATA_TYPE))
    .filter(hasDuplicateFields)
    .map(instance => hasDuplicatesFieldError(instance, instance.value.fullName))
    .toArray()

export default changeValidator
