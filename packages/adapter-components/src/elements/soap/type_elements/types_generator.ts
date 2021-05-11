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
import { values } from '@salto-io/lowerdash'
import _ from 'lodash'
import * as soap from 'soap'
import { RestrictionElement, SchemaElement } from 'soap/lib/wsdl/elements'
import { convertComplexTypes } from './complex_types_converter'
import { linkTypes } from './object_types_linker'
import { convertToNamespaceName } from './utils'

const log = logger(module)

/**
 * This method treats simpleType as an alias to another type
 * (since simpleType can only add restrictions and not elements or attributes)
 */
const getTypeAliases = (schema: SchemaElement): Record<string, string> =>
  _(schema.types)
    .entries()
    .map(([name, simpleType]) => {
      const element = simpleType.children[0]
      if (element instanceof RestrictionElement) {
        return [`${schema.$targetNamespace}|${name}`, convertToNamespaceName(element.$base, element.schemaXmlns ?? {}, schema.$targetNamespace)]
      }
      log.warn(`Received unexpected simple type element restriction: ${element?.name}`)
      return undefined
    })
    .filter(values.isDefined)
    .fromPairs()
    .value()


/**
 * Converts WSDL to object types.
 *
 * This method knowingly does not support:
 *  - complex type inside complex type.
 *  - elements with 'ref' attribute.
 * Also, currently if there are two complex types with the same name in different namespaces,
 * two object types with the same elem id will be created.
 *
 * @param adapterName the adapter name of the converted elements
 * @param wsdl wsdl soap object or a path to the WSDL, can be both local file or a url
 * @returns the converted object types
 */
export const extractTypes = async (
  adapterName: string,
  wsdl: string | soap.WSDL,
): Promise<ObjectType[]> => {
  log.debug('Generating SOAP types')

  const { wsdl: wsdlObj } = wsdl instanceof soap.WSDL
    ? { wsdl }
    : (await soap.createClientAsync(wsdl)) as unknown as { wsdl: soap.WSDL }
  const schemas = Object.values(wsdlObj.definitions.schemas)
  const unresolvedTypes = schemas
    .map((schema: SchemaElement) => convertComplexTypes(adapterName, schema))
    .flat()

  const typeAliases = _.assign({}, ...schemas.map(getTypeAliases))
  const objectTypes = linkTypes(unresolvedTypes, typeAliases)

  const duplicateTypes = _(objectTypes)
    .countBy(type => type.elemID.name)
    .pickBy(count => count > 1)
    .keys()
    .value()

  if (duplicateTypes.length > 0) {
    log.debug(`There are duplicate type names in the WSDL: ${duplicateTypes}`)
  }

  log.debug('Finished generating SOAP types')
  return objectTypes
}
