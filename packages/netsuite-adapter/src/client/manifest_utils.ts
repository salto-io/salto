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
import { collections, values, strings } from '@salto-io/lowerdash'
import { Value } from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import xmlParser from 'fast-xml-parser'
import _ from 'lodash'
import { SCRIPT_ID, WORKFLOW } from '../constants'
import { CustomizationInfo } from './types'
import { ATTRIBUTE_PREFIX } from './constants'

const { makeArray } = collections.array
const { isDefined, lookupValue } = values
const { matchAll } = strings
const log = logger(module)

const TEXT_ATTRIBUTE = '#text'
const REQUIRED_ATTRIBUTE = '@_required'
const INVALID_DEPENDENCIES = ['ADVANCEDEXPENSEMANAGEMENT', 'SUBSCRIPTIONBILLING', 'WMSSYSTEM', 'BILLINGACCOUNTS']
const REFERENCED_OBJECT_REGEX = new RegExp(`${SCRIPT_ID}=(?<${SCRIPT_ID}>[a-z0-9_]+(\\.[a-z0-9_]+)*)`, 'g')

type RequiredDependency = {
  typeName: string
  dependency: string
}

type RequiredDependencyWithCondition = (
  RequiredDependency & {
  condition?: undefined
}) | (
  RequiredDependency & {
  condition: {
    type: 'byPath'
    path: string[]
    value: Value
  }
}) | (
  RequiredDependency & {
  condition: {
    type: 'fullLookup' | 'byValue'
    value: Value
  }
})

const REQUIRED_FEATURES: RequiredDependencyWithCondition[] = [
  {
    typeName: WORKFLOW,
    dependency: 'EXPREPORTS',
    condition: {
      type: 'fullLookup',
      value: 'STDRECORDSUBSIDIARYDEFAULTACCTCORPCARDEXP',
    },
  },
]

const getRequiredFeatures = (customizationInfos: CustomizationInfo[]): string[] =>
  REQUIRED_FEATURES.filter(
    feature => customizationInfos
      .some(custInfo => {
        const { typeName, condition } = feature
        if (typeName !== custInfo.typeName) {
          return false
        }
        switch (condition?.type) {
          case 'byPath':
            return _.get(custInfo.values, condition.path) === condition.value
          case 'byValue':
            return lookupValue(custInfo.values, value => _.isEqual(value, condition.value))
          case 'fullLookup':
            return lookupValue(custInfo.values,
              value => _.isEqual(value, condition.value)
              || (
                _.isString(value)
                && _.isString(condition.value)
                && value.includes(condition.value)
              ))
          default:
            return true
        }
      })
  ).map(({ dependency }) => dependency)

const getRequiredObjects = (customizationInfos: CustomizationInfo[]): string[] => {
  const objNames = new Set(customizationInfos.map(custInfo =>
    custInfo.values[ATTRIBUTE_PREFIX + SCRIPT_ID]))
  return _.uniq(customizationInfos.flatMap(custInfo => {
    const requiredObjects: string[] = []
    lookupValue(custInfo.values, val => {
      if (!_.isString(val)) {
        return
      }

      requiredObjects.push(...Array.from(matchAll(val, REFERENCED_OBJECT_REGEX))
        .map(r => r.groups)
        .filter(isDefined)
        .map(group => group[SCRIPT_ID])
        .filter(scriptId => !objNames.has(scriptId.split('.')[0])))
    })
    return requiredObjects
  }))
}

const fixDependenciesObject = (dependencies: Value): void => {
  dependencies.features = dependencies.features ?? {}
  dependencies.features.feature = dependencies.features.feature ?? []
  dependencies.objects = dependencies.objects ?? {}
  dependencies.objects.object = dependencies.objects.object ?? []
}

const addRequiredDependencies = (
  dependencies: Value,
  customizationInfos: CustomizationInfo[]
): void => {
  const requiredFeatures = getRequiredFeatures(customizationInfos)
    .map(feature => ({ [REQUIRED_ATTRIBUTE]: 'true', [TEXT_ATTRIBUTE]: feature }))
  const requiredObjects = getRequiredObjects(customizationInfos)
  if (requiredFeatures.length === 0 && requiredObjects.length === 0) {
    return
  }

  const { features, objects } = dependencies
  features.feature = [
    // remove required features that are set to "required=false"
    ..._.differenceBy(
      makeArray(features.feature),
      requiredFeatures,
      item => item[TEXT_ATTRIBUTE]
    ),
    ...requiredFeatures,
  ]
  objects.object = _.union(objects.object, requiredObjects)
}

const cleanInvalidDependencies = (dependencies: Value): void => {
  // This is done due to an SDF bug described in SALTO-1107.
  // This function should be removed once the bug is fixed.
  dependencies.features.feature = makeArray(dependencies.features.feature)
    .filter(item => !INVALID_DEPENDENCIES.includes(item[TEXT_ATTRIBUTE]))
}

export const fixManifest = (
  manifestContent: string,
  customizationInfos: CustomizationInfo[]
): string => {
  const manifestXml = xmlParser.parse(manifestContent, { ignoreAttributes: false })

  if (!_.isPlainObject(manifestXml.manifest?.dependencies)) {
    log.warn('manifest.xml is missing dependencies tag')
    return manifestContent
  }

  const { dependencies } = manifestXml.manifest
  fixDependenciesObject(dependencies)
  cleanInvalidDependencies(dependencies)
  addRequiredDependencies(dependencies, customizationInfos)

  // eslint-disable-next-line new-cap
  const fixedDependencies = new xmlParser.j2xParser({
    ignoreAttributes: false,
    format: true,
  }).parse({ dependencies })
  return manifestContent.replace(
    new RegExp('<dependencies>.*</dependencies>\\n?', 'gs'), fixedDependencies
  )
}
