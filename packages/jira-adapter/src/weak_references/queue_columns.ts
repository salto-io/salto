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
  GetCustomReferencesFunc,
  InstanceElement,
  ReferenceInfo,
  isInstanceElement,
  isReferenceExpression,
} from '@salto-io/adapter-api'
import { collections, values } from '@salto-io/lowerdash'
import { logger } from '@salto-io/logging'
import { QUEUE_TYPE } from '../constants'
import { WeakReferencesHandler } from './weak_references_handler'

const { awu } = collections.asynciterable

const log = logger(module)

const getFieldReferences = async (instance: InstanceElement): Promise<ReferenceInfo[]> => {
  const { columns } = instance.value
  if (columns === undefined || !Array.isArray(columns)) {
    log.warn(
      `columns value is corrupted in instance ${instance.elemID.getFullName()}, hence not calculating fields weak references`,
    )
    return []
  }

  return awu(columns)
    .map(async (field, index) =>
      isReferenceExpression(field)
        ? { source: instance.elemID.createNestedID(index.toString()), target: field.elemID, type: 'weak' as const }
        : undefined,
    )
    .filter(values.isDefined)
    .toArray()
}

/**
 * Marks each field reference in queue as a weak reference.
 */
const getQueueFieldsReferences: GetCustomReferencesFunc = async elements =>
  awu(elements)
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === QUEUE_TYPE)
    .flatMap(getFieldReferences)
    .toArray()

/**
 * Remove invalid columns (not references or missing references) from queues.
 */
const removeMissingColumnsQueues: WeakReferencesHandler['removeWeakReferences'] =
  ({ elementsSource }) =>
  async elements => {
    const fixedElements = await awu(elements)
      .filter(isInstanceElement)
      .filter(instance => instance.elemID.typeName === QUEUE_TYPE)
      .map(async instance => {
        const { columns } = instance.value
        if (columns === undefined) {
          log.warn(
            `columns value is corrupted in instance ${instance.elemID.getFullName()}, hence not omitting missing fields`,
          )
          return undefined
        }

        const fixedInstance = instance.clone()
        fixedInstance.value.columns = await awu(columns)
          .filter(
            async field =>
              field === undefined ||
              !isReferenceExpression(field) ||
              // eslint-disable-next-line no-return-await
              (await elementsSource.has(field.elemID)),
          )
          .toArray()

        if (fixedInstance.value.columns.length === instance.value.columns.length) {
          return undefined
        }

        return fixedInstance
      })
      .filter(values.isDefined)
      .toArray()

    const errors = fixedElements.map(instance => ({
      elemID: instance.elemID.createNestedID('columns'),
      severity: 'Info' as const,
      message: 'Queue will be deployed without columns defined on non-existing fields',
      detailedMessage:
        'This queue has columns which use fields which no longer exist. It will be deployed without them.',
    }))
    return { fixedElements, errors }
  }

export const queueFieldsHandler: WeakReferencesHandler = {
  findWeakReferences: getQueueFieldsReferences,
  removeWeakReferences: removeMissingColumnsQueues,
}
