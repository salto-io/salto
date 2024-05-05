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
import _ from 'lodash'
import {
  CORE_ANNOTATIONS,
  ElemIdGetter,
  InstanceElement,
  ReferenceExpression,
  isInstanceElement,
} from '@salto-io/adapter-api'
import { getParent, hasValidParent, naclCase, pathNaclCase } from '@salto-io/adapter-utils'
import { elements as elementUtils } from '@salto-io/adapter-components'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { ACCESS_POLICY_RULE_TYPE_NAME, ACCESS_POLICY_TYPE_NAME, OKTA } from '../constants'

const log = logger(module)

const getDefaultAccessPolicyName = (name: string, instance: InstanceElement, getElemIdFunc?: ElemIdGetter): string => {
  const naclCasedName = naclCase(name)
  if (getElemIdFunc === undefined) {
    return naclCasedName
  }

  const serviceIds = elementUtils.createServiceIds({
    entry: instance.value,
    serviceIDFields: ['id'],
    typeID: instance.refType.elemID,
  })

  return getElemIdFunc(OKTA, serviceIds, naclCasedName).name
}

/**
 * Each Okta tenant has exactly one default access policy configured marked with "system = true"
 * The default policy can be renamed, but it has a specific function and can only be partially modified,
 * therefore, we should verify default policies across envs will have the same elemID.
 * The filter modifies elemID for the default access policy and all its rules
 * */
const filter: FilterCreator = ({ getElemIdFunc }) => ({
  name: 'renameDefaultAccessPolicy',
  onFetch: async elements => {
    const instances = elements.filter(isInstanceElement)
    const defaultAccessPolicy = instances
      .filter(instance => instance.elemID.typeName === ACCESS_POLICY_TYPE_NAME)
      .find(instance => instance.value.system === true)
    if (defaultAccessPolicy === undefined) {
      log.debug('The default access policy was not found, skipping renaming')
      return
    }

    const defaultPolicyRules = instances
      .filter(instance => instance.elemID.typeName === ACCESS_POLICY_RULE_TYPE_NAME)
      .filter(instance =>
        hasValidParent(instance)
          ? getParent(instance).elemID.getFullName() === defaultAccessPolicy.elemID.getFullName()
          : false,
      )

    const defaultName = 'Default Policy'
    const updatedName = getDefaultAccessPolicyName(defaultName, defaultAccessPolicy, getElemIdFunc)
    const updatedPath = [
      ...(defaultAccessPolicy.path?.slice(0, defaultAccessPolicy.path?.length - 2) ?? []),
      pathNaclCase(updatedName),
      pathNaclCase(updatedName),
    ]
    const renamedPolicy = new InstanceElement(
      updatedName,
      defaultAccessPolicy.getTypeSync(),
      defaultAccessPolicy.value,
      updatedPath,
      defaultAccessPolicy.annotations,
    )

    const renamedRules = defaultPolicyRules.map(rule => {
      const updatedRuleName = getDefaultAccessPolicyName(`${defaultName}__${rule.value.name}`, rule, getElemIdFunc)
      return new InstanceElement(
        updatedRuleName,
        rule.getTypeSync(),
        rule.value,
        [
          ...(rule.path?.slice(0, rule.path?.length - 3) ?? []),
          pathNaclCase(updatedName),
          'policyRules',
          pathNaclCase(updatedRuleName),
        ],
        {
          ...rule.annotations,
          [CORE_ANNOTATIONS.PARENT]: [new ReferenceExpression(renamedPolicy.elemID, renamedPolicy)],
        },
      )
    })

    _.pullAll(elements, [defaultAccessPolicy, ...defaultPolicyRules])
    elements.push(renamedPolicy)
    renamedRules.forEach(rule => elements.push(rule))
  },
})

export default filter
