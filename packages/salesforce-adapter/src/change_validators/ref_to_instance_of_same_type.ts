/*
*                      Copyright 2022 Salto Labs Ltd.
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
import _ from 'lodash'
import { walkOnElement, WalkOnFunc, WALK_NEXT_STEP } from '@salto-io/adapter-utils'
import { ChangeValidator, getChangeData, InstanceElement, isAdditionChange, ElemID, SeverityLevel, isReferenceExpression } from '@salto-io/adapter-api'
import { values, collections } from '@salto-io/lowerdash'
import { isInstanceOfCustomObjectChange } from '../custom_object_instances_deploy'
import { apiName } from '../transformers/transformer'

const { awu, groupByAsync } = collections.asynciterable

const getDepOnAdditionOfSameTypeInstanceIDs = async (
  instance: InstanceElement,
  typeToAdditionInstancesElemIDs: Record<string, ElemID[]>,
): Promise<ElemID[]> => {
  const dependentOnAdditionInstanceIDs: ElemID[] = []
  const typeAdditionInstancesElemIDs = typeToAdditionInstancesElemIDs[
    (await apiName(await (instance as InstanceElement).getType(), true))
  ]
  const func: WalkOnFunc = ({ value }) => {
    if (isReferenceExpression(value)
      && typeAdditionInstancesElemIDs.find(elemID => elemID.isEqual(value.elemID))) {
      dependentOnAdditionInstanceIDs.push(value.elemID)
      return WALK_NEXT_STEP.SKIP
    }
    return WALK_NEXT_STEP.RECURSE
  }
  walkOnElement({ element: instance, func })
  return dependentOnAdditionInstanceIDs
}

const changeValidator: ChangeValidator = async changes => {
  const typeToAdditionInstancesElemIDs = _.mapValues(await groupByAsync(
    awu(changes)
      .filter(isInstanceOfCustomObjectChange)
      .filter(isAdditionChange)
      .map(getChangeData)
      .map(async instance => (
        {
          type: (await apiName(await (instance as InstanceElement).getType(), true)),
          elemID: instance.elemID,
        }
      )),
    te => te.type,
  ),
  teArr => teArr.map(te => te.elemID))
  return awu(changes)
    .filter(isInstanceOfCustomObjectChange)
    .filter(isAdditionChange)
    .map(getChangeData)
    .map(async instance => {
      const dependentOnAdditionOfSameTypeInstancesIds = await getDepOnAdditionOfSameTypeInstanceIDs(
        instance as InstanceElement,
        typeToAdditionInstancesElemIDs,
      )
      if (dependentOnAdditionOfSameTypeInstancesIds.length === 0) {
        return undefined
      }
      return ({
        elemID: instance.elemID,
        severity: 'Error' as SeverityLevel,
        message: 'Instance depends on a new instance that has no ID yet. Run this deploy and then deploy again to avoid this error.',
        detailedMessage: `Instance ${instance.elemID.getFullName()} depends on new instance that has no ID yet: ${dependentOnAdditionOfSameTypeInstancesIds.map(e => e.getFullName()).join(', ')}`,
      })
    })
    .filter(values.isDefined)
    .toArray()
}

export default changeValidator
