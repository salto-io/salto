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
import { ChangeError, ChangeValidator, CORE_ANNOTATIONS, Element, getChangeData } from '@salto-io/adapter-api'
import _ from 'lodash'
import { collections, values } from '@salto-io/lowerdash'
import { apiName } from '../transformers/transformer'
import { NAMESPACE_SEPARATOR } from '../constants'
import { INSTANCE_SUFFIXES } from '../types'

const { awu } = collections.asynciterable
const { isDefined } = values


const createPackageElementModificationChangeWarning = (
  { elemID, annotations }: Element,
  namespace: string
): ChangeError => ({
  elemID,
  severity: 'Warning',
  message: 'Modification of element from managed package may not be allowed',
  detailedMessage: `Modification of element ${elemID.getFullName()} from managed package with namespace ${namespace} may not be allowed. `
  + `For more information refer to ${annotations[CORE_ANNOTATIONS.SERVICE_URL]}. If you cannot find the information there refer to https://developer.salesforce.com/docs/atlas.en-us.sfdx_dev.meta/sfdx_dev/packaging_packageable_components.htm`,
})

export const hasNamespace = async (customElement: Element): Promise<boolean> => {
  const apiNameResult = await apiName(customElement, true)
  if (_.isUndefined(apiNameResult)) {
    return false
  }
  const partialFullName = apiNameResult.split('-')[0]

  const elementSuffix = INSTANCE_SUFFIXES
    .map(suffix => `__${suffix}`)
    .find(suffix => partialFullName.endsWith(suffix))

  const cleanFullName = elementSuffix !== undefined
    ? partialFullName.slice(0, -elementSuffix.length)
    : partialFullName
  return cleanFullName.includes(NAMESPACE_SEPARATOR)
}

export const getNamespace = async (customElement: Element): Promise<string | undefined> => {
  const parts = (await apiName(customElement, true))?.split(NAMESPACE_SEPARATOR) ?? []
  return parts.length > 1 ? parts[0] : undefined
}


export const PACKAGE_VERSION_FIELD_NAME = 'version_number'

const changeValidator: ChangeValidator = async changes => (
  awu(changes)
    .map(getChangeData)
    .map(async element => {
      const elementNamespace = await getNamespace(element)
      return isDefined(elementNamespace)
        ? createPackageElementModificationChangeWarning(element, elementNamespace)
        : undefined
    })
    .filter(isDefined)
    .toArray()
)

export default changeValidator
