/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  ChangeValidator,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import _ from 'lodash'
import { PAGE_TYPE_NAME } from '../constants'

const log = logger(module)
const { awu } = collections.asynciterable

export const uniquePageTitleUnderSpaceValidator: ChangeValidator = async (changes, elementSource) => {
  if (elementSource === undefined) {
    log.warn('elementSource is undefined, skipping uniquePageTitleUnderSpaceValidator')
    return []
  }
  const pageChanges = changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === PAGE_TYPE_NAME)

  const spaceNameIdToPageInstances = await awu(await elementSource.getAll()).reduce<Record<string, InstanceElement[]>>(
    (record, elem) => {
      if (isInstanceElement(elem) && elem.elemID.typeName === PAGE_TYPE_NAME) {
        const spaceElemId = elem.value.spaceId.elemID.getFullName()
        record[spaceElemId] ??= []
        record[spaceElemId].push(elem)
      }
      return record
    },
    {},
  )
  const spaceNameToTitleToPageInstancesIndex: Record<string, Record<string, InstanceElement[]>> = _.mapValues(
    spaceNameIdToPageInstances,
    pages =>
      pages.reduce<Record<string, InstanceElement[]>>((record, page) => {
        const { title } = page.value
        record[title] ??= []
        record[title].push(page)
        return record
      }, {}),
  )
  return pageChanges.flatMap(pageInstFromChange => {
    const titleToPageIndex =
      spaceNameToTitleToPageInstancesIndex[pageInstFromChange.value.spaceId.elemID.getFullName()] ?? {}
    const pageWithTheSameTitle = titleToPageIndex[pageInstFromChange.value.title]?.find(
      page => !page.elemID.isEqual(pageInstFromChange.elemID),
    )
    if (pageWithTheSameTitle === undefined) {
      return []
    }
    return [
      {
        elemID: pageInstFromChange.elemID,
        severity: 'Error',
        message: '"Page" title must be unique under space',
        detailedMessage: `"Page" title: ${pageInstFromChange.value.title} is already in use by page: ${pageWithTheSameTitle.elemID.getFullName()}`,
      },
    ]
  })
}
