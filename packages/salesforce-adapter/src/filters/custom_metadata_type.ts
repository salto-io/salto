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
import { Change, getAllChangeData, getChangeData, isObjectType, ObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterWith, LocalFilterCreator } from '../filter'
import { isCustomMetadataType } from './utils'

const NON_DEPLOYABLE_FIELDS = [
  'Language',
]

const NON_DEPLOYABLE_ANNOTATIONS = [
  'deploymentStatus',
  'nameField',
]

const omitNonDeployableFields = (customMetadataType: ObjectType): void => {
  customMetadataType.fields = _.omit(customMetadataType.fields, NON_DEPLOYABLE_FIELDS)
}

const omitNonDeployableAnnotations = (customMetadataType: ObjectType): void => {
  customMetadataType.annotations = _.omit(
    customMetadataType.annotations,
    NON_DEPLOYABLE_ANNOTATIONS
  )
}

const isCustomMetadataTypeChange = (change: Change): change is Change<ObjectType> => {
  const changeElement = getChangeData(change)
  return isObjectType(changeElement) && isCustomMetadataType(changeElement)
}

const filterCreator: LocalFilterCreator = () : FilterWith<'onFetch'> & FilterWith<'preDeploy'> => ({
  onFetch: async elements => {
    elements
      .filter(isObjectType)
      .filter(isCustomMetadataType)
      .forEach(omitNonDeployableFields)
  },
  preDeploy: async changes => {
    changes
      .filter(isCustomMetadataTypeChange)
      .flatMap(getAllChangeData)
      .forEach(change => {
        omitNonDeployableFields(change)
        omitNonDeployableAnnotations(change)
      })
  },
})

export default filterCreator
