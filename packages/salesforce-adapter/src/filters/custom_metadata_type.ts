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
import { isObjectType, ObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { FilterWith, LocalFilterCreator } from '../filter'
import { isCustomMetadataType } from './utils'

const NON_DEPLOYABLE_FIELDS = [
  'Language',
]

const omitNonDeployableFields = (customMetadataType: ObjectType): void => {
  customMetadataType.fields = _.omit(customMetadataType.fields, NON_DEPLOYABLE_FIELDS)
}

const filterCreator: LocalFilterCreator = () : FilterWith<'onFetch'> => ({
  onFetch: async elements => {
    elements
      .filter(isObjectType)
      .filter(isCustomMetadataType)
      .forEach(omitNonDeployableFields)
  },
})

export default filterCreator
