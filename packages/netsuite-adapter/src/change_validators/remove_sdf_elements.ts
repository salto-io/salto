/*
*                      Copyright 2023 Salto Labs Ltd.
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
import { Change, isRemovalChange, getChangeData, Element, isInstanceElement, isObjectType, isField, ChangeError } from '@salto-io/adapter-api'
import { values, collections } from '@salto-io/lowerdash'
import { isCustomRecordType, isStandardType, hasInternalId } from '../types'
import { LazyElementsSourceIndexes } from '../elements_source_index/types'
import { NetsuiteChangeValidator } from './types'

const { isDefined } = values
const { awu } = collections.asynciterable

const validateRemovableChange = async (
  element: Element,
  changes: ReadonlyArray<Change>,
  elementsSourceIndex?: LazyElementsSourceIndexes
): Promise<ChangeError | undefined> => {
  if (isInstanceElement(element) && isStandardType(element.refType)) {
    if (!hasInternalId(element)) {
      return {
        elemID: element.elemID,
        severity: 'Error',
        message: `Can't remove instances of type ${element.elemID.typeName}`,
        detailedMessage: `Can't remove instance ${element.elemID.name} of type ${element.elemID.typeName}. NetSuite supports the removal of these instances only from their UI`,
      }
    }
  } else if (isObjectType(element) && isCustomRecordType(element)) {
    if (!hasInternalId(element)) {
      return {
        elemID: element.elemID,
        severity: 'Error',
        message: 'Removal of Custom Record Type failed. ID is missing',
        detailedMessage: `Can't remove this Custom Record Type ${element.elemID.name}. The ID is missing, please try to refetch`,
      }
    }
    // will be redundant once SALTO-3534 introduced
    if (elementsSourceIndex !== undefined) {
      const recordTypeIndexInstances = Object.keys((await elementsSourceIndex.getIndexes()).internalIdsIndex)
        .some(elemInternalId => elemInternalId.startsWith(element.elemID.typeName.concat('-')))
      if (recordTypeIndexInstances) {
        return {
          elemID: element.elemID,
          severity: 'Error',
          message: 'Can\'t remove Custom Record Type with existing instances',
          detailedMessage: `Can't remove Custom Record Type ${element.elemID.name} with existing instances. Please delete those instances first`,
        }
      }
    }
    return {
      elemID: element.elemID,
      severity: 'Warning',
      message: 'Removal of Custom Record Type will delete all existing instances',
      detailedMessage: `Removal of Custom Record Type ${element.elemID.name} will delete all instances if such exist`,
    }
  } else if (isField(element) && isCustomRecordType(element.parent)) {
    if (!changes
      .filter(isRemovalChange)
      .map(getChangeData)
      .filter(isObjectType)
      .some(elem => elem.elemID.isEqual(element.parent.elemID))) {
      return {
        elemID: element.elemID,
        severity: 'Error',
        message: 'Can\'t remove fields of Custom Record Types',
        detailedMessage: `Can't remove field ${element.elemID.name} of Custom Record Type ${element.elemID.typeName}. NetSuite supports the removal of fields of Custom Record Types only from their UI`,
      }
    }
  }
  return undefined
}

const changeValidator: NetsuiteChangeValidator = async (changes, _deployReferencedElements, elementsSourceIndex) => (
  awu(changes)
    .filter(isRemovalChange)
    .map(getChangeData)
    .map(element => validateRemovableChange(element, changes, elementsSourceIndex))
    .filter(isDefined)
    .toArray()
)

export default changeValidator
