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
