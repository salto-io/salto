/*
*                      Copyright 2021 Salto Labs Ltd.
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
import { BuiltinTypes, ObjectType, ReferenceExpression } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { elements as elementsComponents } from '@salto-io/adapter-components'
import NetsuiteClient from '../client/client'

export const SUPPORTED_TYPES = ['Account', 'Subsidiary', 'Department', 'Classification', 'Location', 'Currency']

const log = logger(module)


export const getDataTypes = async (
  client: NetsuiteClient
): Promise<ObjectType[]> => {
  if (!client.isSuiteAppConfigured()) {
    return []
  }

  const wsdl = await client.getNetsuiteWsdl()
  if (wsdl === undefined) {
    log.warn('Failed to get WSDL, skipping dataTypes')
    return []
  }
  const types = await elementsComponents.soap.extractTypes('netsuite', wsdl)

  types.forEach(type => {
    type.annotationRefTypes.source = new ReferenceExpression(BuiltinTypes.HIDDEN_STRING.elemID)
    type.annotations.source = 'soap'
  })
  return types
}
