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
import { getAllReferencedIds } from '@salto-io/adapter-utils'
import { ChangeValidator, getChangeData, isAdditionChange, isInstanceChange, SeverityLevel } from '@salto-io/adapter-api'
import { values, collections } from '@salto-io/lowerdash'
import { isInstanceOfCustomObjectChange } from '../custom_object_instances_deploy'
import { apiName } from '../transformers/transformer'

const { awu, groupByAsync } = collections.asynciterable

const changeValidator: ChangeValidator = async changes => {
  const typeToAdditionInstances = _.mapValues(await groupByAsync(
    awu(changes)
      .filter(isInstanceOfCustomObjectChange)
      .filter(isInstanceChange)
      .filter(isAdditionChange)
      .map(getChangeData)
      .map(async instance => (
        {
          type: (await apiName(await instance.getType())),
          instance,
        }
      )),
    typeInstance => typeInstance.type,
  ),
  typeInstances => typeInstances.map(te => te.instance))
  return Object.values(typeToAdditionInstances)
    .flatMap(instances => {
      const instancesElemIDs = instances.map(inst => inst.elemID)
      return instances.map(instance => {
        const referencedElemIDsStr = getAllReferencedIds(instance)
        const dependentOnAdditionInstanceIDs = instancesElemIDs.filter(elemID =>
          referencedElemIDsStr.has(elemID.getFullName()))
        if (dependentOnAdditionInstanceIDs.length === 0) {
          return undefined
        }
        return ({
          elemID: instance.elemID,
          severity: 'Error' as SeverityLevel,
          message: 'This new instance cannot be deployed, as it contains a reference to another new instance. To successfully deploy both instances, please run this deploy, then another deploy to create the referencing instance.',
          detailedMessage: `New instance ${instance.elemID.getFullName()} cannot be deployed, as it contains a reference to another new instance ${dependentOnAdditionInstanceIDs.map(e => e.getFullName()).join(', ')}. To successfully deploy both instances, please run this deploy to create ${dependentOnAdditionInstanceIDs.map(e => e.getFullName()).join(', ')}, then another deploy to create ${instance.elemID.getFullName()}.`,
        })
      }).filter(values.isDefined)
    })
}

export default changeValidator
