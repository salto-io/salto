/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import {
  ChangeError,
  getChangeData,
  isAdditionOrModificationChange,
  Element,
  isField,
  isObjectTypeChange,
} from '@salto-io/adapter-api'
import { walkOnElement, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import { captureServiceIdInfo } from '../service_id_info'
import { isStandardInstanceOrCustomRecordType } from '../types'
import { NetsuiteChangeValidator } from './types'

const { isDefined } = values
const CUSTOM_COLLECTION = 'custcollection'
const MESSAGE = 'Cannot deploy element with invalid translation reference'

const missingReferencesString = (references: string[]): string =>
  `${references.length > 1 ? 'references' : 'a reference'} to the following translation collection${references.length > 1 ? 's' : ''} that do not exist in your environment:` +
  ` ${references.map(reference => `'${reference}'`).join(', ')}`

const actionString = (references: string[]): string =>
  `To proceed with the deployment, please edit the NACL and replace the ${references.length > 1 ? 'references with valid strings' : 'reference with a valid string'}.` +
  ' After the deployment, you can reconnect the elements in the NetSuite UI.'

const toChangeErrorForElement = (element: Element, references: string[]): ChangeError => ({
  elemID: element.elemID,
  severity: 'Error',
  message: MESSAGE,
  detailedMessage:
    `Cannot deploy this element because it contains ${missingReferencesString(references)}.` +
    ` ${actionString(references)}`,
})

const toChangeErrorForParent = (element: Element, referencesInParent: string[]): ChangeError => ({
  elemID: element.elemID,
  severity: 'Error',
  message: MESSAGE,
  detailedMessage:
    `Cannot deploy this field because its parent type contains ${missingReferencesString(referencesInParent)}.` +
    ` ${actionString(referencesInParent)}`,
})

const toChangeErrorForElementAndParent = (
  element: Element,
  references: string[],
  referencesInParent: string[],
): ChangeError => ({
  elemID: element.elemID,
  severity: 'Error',
  message: MESSAGE,
  detailedMessage:
    `Cannot deploy this field because it contains ${missingReferencesString(references)}.` +
    ` In addition, its parent type contains ${missingReferencesString(referencesInParent)}.` +
    ` ${actionString(references.concat(referencesInParent))}`,
})

const changeValidator: NetsuiteChangeValidator = async changes => {
  const typesChangesIds = new Set(
    changes
      .filter(isObjectTypeChange)
      .map(getChangeData)
      .map(type => type.elemID.getFullName()),
  )
  return changes
    .filter(isAdditionOrModificationChange)
    .map(getChangeData)
    .filter(isStandardInstanceOrCustomRecordType)
    .map(element => {
      const customCollectionReferences: string[] = []
      const customCollectionReferencesInParent: string[] = []
      walkOnElement({
        element:
          isField(element) && !typesChangesIds.has(element.parent.elemID.getFullName()) ? element.parent : element,
        func: ({ path, value }) => {
          if (_.isString(value)) {
            const pushToArray = element.elemID.isParentOf(path)
              ? customCollectionReferences
              : customCollectionReferencesInParent
            pushToArray.push(
              ...captureServiceIdInfo(value)
                .map(serviceIdInfo => serviceIdInfo.serviceId)
                .filter(serviceId => serviceId.startsWith(CUSTOM_COLLECTION))
                .map(serviceId => serviceId.split('.')[0]),
            )
            return WALK_NEXT_STEP.SKIP
          }
          return WALK_NEXT_STEP.RECURSE
        },
      })
      if (customCollectionReferences.length > 0 && customCollectionReferencesInParent.length === 0) {
        return toChangeErrorForElement(element, _.uniq(customCollectionReferences))
      }
      if (customCollectionReferences.length === 0 && customCollectionReferencesInParent.length > 0) {
        return toChangeErrorForParent(element, _.uniq(customCollectionReferencesInParent))
      }
      if (customCollectionReferences.length > 0 && customCollectionReferencesInParent.length > 0) {
        return toChangeErrorForElementAndParent(
          element,
          _.uniq(customCollectionReferences),
          _.uniq(customCollectionReferencesInParent),
        )
      }
      return undefined
    })
    .filter(isDefined)
}

export default changeValidator
