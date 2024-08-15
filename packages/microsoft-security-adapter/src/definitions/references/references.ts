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
import { definitions, references as referenceUtils, createChangeElementResolver } from '@salto-io/adapter-components'
import { Change, InstanceElement } from '@salto-io/adapter-api'
import { ODATA_TYPE_FIELD_NACL_CASE, entraConstants } from '../../constants'
import { Options } from '../types'
import { REFERENCE_RULES } from './entra_reference_rules'

export const REFERENCES: definitions.ApiDefinitions<Options>['references'] = {
  rules: REFERENCE_RULES,
  fieldsToGroupBy: ['id', 'name', 'appId'],
  serializationStrategyLookup: {
    appId: {
      serialize: ({ ref }) => ref.value.value.appId,
      lookup: referenceUtils.basicLookUp,
      lookupIndexName: 'appId',
    },
  },
  contextStrategyLookup: {
    ODataType: referenceUtils.neighborContextGetter({
      contextFieldName: ODATA_TYPE_FIELD_NACL_CASE,
      getLookUpName: async ({ ref }) => ref.elemID.name,
      contextValueMapper: refType => entraConstants.SUPPORTED_DIRECTORY_OBJECTS_ODATA_TYPE_NAME_TO_TYPE_NAME[refType],
    }),
  },
}

const resolverCreator = referenceUtils.getResolverCreator<Options>({ references: REFERENCES })
export const changeResolver = createChangeElementResolver<Change<InstanceElement>>({
  getLookUpName: referenceUtils.generateLookupFunc(REFERENCE_RULES, resolverCreator),
})
