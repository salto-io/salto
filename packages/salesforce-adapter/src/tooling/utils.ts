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
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { values } from '@salto-io/lowerdash'
import { TOOLING_PATH, ToolingObjectAnnotation } from './constants'
import { API_NAME, RECORDS_PATH, SALESFORCE } from '../constants'
import { SupportedToolingObjectName, ToolingField, ToolingObjectType } from './types'
import { SalesforceRecord } from '../client/types'
import { DEFAULT_ID_FIELDS, ID_FIELDS_BY_TYPE } from './id_fields'
import { omitDefaultKeys } from '../filters/utils'

const { isDefined } = values

export const toolingObjectApiName = (toolingObject: ToolingObjectType): SupportedToolingObjectName => (
  toolingObject.annotations[API_NAME]
)

export const toolingFieldApiName = (toolingField: ToolingField): string => (
  toolingField.annotations[API_NAME]
)

export const createToolingObject = (
  objectName: SupportedToolingObjectName,
  fields: ToolingObjectType['fields'] = {}
): ToolingObjectType => (
  Object.assign(
    new ObjectType({
      elemID: new ElemID(SALESFORCE, objectName),
    }),
    {
      path: [...TOOLING_PATH, objectName] as const,
      annotations: {
        [CORE_ANNOTATIONS.CREATABLE]: false,
        [CORE_ANNOTATIONS.UPDATABLE]: false,
        [CORE_ANNOTATIONS.DELETABLE]: false,
        [API_NAME]: objectName,
        [ToolingObjectAnnotation.isToolingObject]: true as const,
      },
      fields,
    }
  )
)

export const createToolingInstance = async (
  salesforceRecord: SalesforceRecord,
  toolingObject: ToolingObjectType
): Promise<InstanceElement> => {
  const typeName = toolingObjectApiName(toolingObject)
  const idFields = ID_FIELDS_BY_TYPE[typeName] ?? DEFAULT_ID_FIELDS
  const instanceName = Object.values(_.pick(salesforceRecord, idFields))
    .filter(isDefined)
    .join('_')
  return new InstanceElement(
    naclCase(instanceName),
    toolingObject,
    omitDefaultKeys(salesforceRecord),
    [SALESFORCE, RECORDS_PATH, typeName, pathNaclCase(instanceName)],
  )
}
