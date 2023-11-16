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
import _ from 'lodash'
import { CORE_ANNOTATIONS } from '@salto-io/adapter-api'
import { LocalFilterCreator } from '../filter'
import { TOPICS_FOR_OBJECTS_METADATA_TYPE } from '../constants'
import { isMetadataObjectType } from '../transformers/transformer'


const METADATA_TYPES_TO_HIDE = [
  // CUSTOM_OBJECT,
  TOPICS_FOR_OBJECTS_METADATA_TYPE,
]

const filterCreator: LocalFilterCreator = () => ({
  name: 'hideTypesFilter',
  onFetch: async elements => {
    const metadataTypesByName = _.keyBy(
      elements.filter(isMetadataObjectType),
      metadataType => metadataType.annotations.metadataType
    )
    METADATA_TYPES_TO_HIDE.forEach(typeName => {
      const metadataType = metadataTypesByName[typeName]
      if (metadataType !== undefined) {
        metadataType.annotations[CORE_ANNOTATIONS.HIDDEN] = true
      }
    })
  },
})

export default filterCreator
