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
import { ObjectType } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { elements as elementsComponents } from '@salto-io/adapter-components'
import _ from 'lodash'
import NetsuiteClient from './client/client'
import { NETSUITE } from './constants'

const log = logger(module)

export const getDataTypes = async (
  typeNames: string[],
  client: NetsuiteClient
): Promise<ObjectType[]> => {
  if (typeNames.length === 0) {
    return []
  }

  const wsdl = await client.getNetsuiteWsdl()
  if (wsdl === undefined) {
    log.warn('Failed to get WSDL, skipping dataTypes')
    return []
  }
  const topLevelTypes = (await elementsComponents.soap.extractTypes('netsuite', wsdl))

  const types = elementsComponents.filterTypes(NETSUITE, topLevelTypes, typeNames)

  const duplicateTypes = _(types)
    .countBy(type => type.elemID.name)
    .pickBy(count => count > 1)
    .keys()
    .value()

  if (duplicateTypes.length > 0) {
    throw new Error(`There are duplicate type names: ${duplicateTypes}`)
  }
  return types
}
