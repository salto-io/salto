/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ChangeError, ChangeValidator, InstanceElement, getChangeData, isInstanceChange } from '@salto-io/adapter-api'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { LAYOUT_TYPE_ID_METADATA_TYPE } from '../constants'
import { isInstanceOfTypeSync } from '../filters/utils'

const { awu } = collections.asynciterable

type LayoutItem = {
  field?: string
}

type LayoutColumn = {
  layoutItems?: LayoutItem[]
}

type LayoutSection = {
  layoutColumns?: LayoutColumn[]
}

const hasDuplicatesFieldError = ({ elemID }: InstanceElement, objectName: string): ChangeError => ({
  elemID,
  severity: 'Error',
  message: 'Layout columns can not duplicate field as layout items',
  detailedMessage: `The ${objectName} contains a layout column with duplicate layout items. Please remove the duplicate layout item in order to deploy.`,
})

const hasDuplicateFields = (instance: InstanceElement): boolean => {
  // Check if layoutSections is defined
  if (!instance.value.layoutSections) {
    return false
  }

  // Collect fields from layout items using map and flat
  const fields: string[] = instance.value.layoutSections.flatMap(
    (section: LayoutSection) =>
      section.layoutColumns?.flatMap(
        column => column.layoutItems?.map(item => item.field).filter(field => field !== undefined) || [],
      ) || [],
  )

  // Check for duplicates
  const uniqueFields = _.uniq(fields)
  return uniqueFields.length !== fields.length // If lengths differ, there are duplicates
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
