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
import { logger } from '@salto-io/logging'
import { Change, isRemovalChange, getChangeData, Element, isInstanceElement, isObjectType, isField, ChangeError, ObjectType } from '@salto-io/adapter-api'
import { values, collections } from '@salto-io/lowerdash'
import { isCustomRecordType, isStandardType, hasInternalId } from '../types'
import { NetsuiteChangeValidator } from './types'
import { isSupportedInstance } from '../filters/internal_ids/sdf_internal_ids'

const log = logger(module)
const { isDefined } = values
const { awu } = collections.asynciterable

type HasInstancesFunc = (element: ObjectType) => Promise<boolean>

const validateRemovableChange = async (
  element: Element,
  changes: ReadonlyArray<Change>,
  hasInstances: HasInstancesFunc
): Promise<ChangeError | undefined> => {
  if (isInstanceElement(element) && isStandardType(element.refType)) {
    if (!isSupportedInstance(element)) {
      return {
        elemID: element.elemID,
        severity: 'Error',
        message: `Can't remove instances of type ${element.elemID.typeName}`,
        detailedMessage: `Can't remove this ${element.elemID.typeName}. Remove it in NetSuite UI`,
      }
    }
    if (!hasInternalId(element)) {
      return {
        elemID: element.elemID,
        severity: 'Error',
        message: `Can't remove instance of type ${element.elemID.typeName}`,
        detailedMessage: `Can't remove this ${element.elemID.typeName}. Try fetching and deploying again, or remove it in Netsuite UI`,
      }
    }
  } else if (isObjectType(element) && isCustomRecordType(element)) {
    if (!hasInternalId(element)) {
      return {
        elemID: element.elemID,
        severity: 'Error',
        message: 'Can\'t remove Custom Record Type',
        detailedMessage: 'Can\'t remove this Custom Record Type. Try fetching and deploying again, or remove it in Netsuite UI',
      }
    }
    // will be redundant once SALTO-3534 introduced
    if (await hasInstances(element)) {
      return {
        elemID: element.elemID,
        severity: 'Error',
        message: 'Can\'t remove Custom Record Types that are currently in use',
        detailedMessage: 'Can\'t remove this Custom Record Type. Remove its instances and try again',
      }
    }
    return {
      elemID: element.elemID,
      severity: 'Warning',
      message: 'Instances of Custom Record Type might be removed',
      detailedMessage: 'If there are instances of this Custom Record Type in your Netsuite account - they will be removed',
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
        detailedMessage: `Can't remove field ${element.elemID.name} of this Custom Record Type. Remove it in NetSuite UI`,
      }
    }
  }
  return undefined
}

const changeValidator: NetsuiteChangeValidator = async (changes, _deployReferencedElements, elementsSource) => {
  let typesWithInstances: Set<string> | undefined
  const hasInstances = async (element: ObjectType): Promise<boolean> => {
    if (!elementsSource) {
      return false
    }
    if (typesWithInstances === undefined) {
      typesWithInstances = await log.time(async () => new Set(
        await awu(await elementsSource.list())
          .filter(elemId => elemId.idType === 'instance')
          .map(elemId => elemId.typeName)
          .toArray()
      ), 'creating types with instances set')
    }
    return typesWithInstances.has(element.elemID.name)
  }
  return awu(changes)
    .filter(isRemovalChange)
    .map(getChangeData)
    .map(element => validateRemovableChange(element, changes, hasInstances))
    .filter(isDefined)
    .toArray()
}

export default changeValidator
