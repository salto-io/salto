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
import {
  Change,
  Element,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  isReferenceExpression, isTemplateExpression,
  ReferenceExpression,
  TemplateExpression,
  TemplatePart,
} from '@salto-io/adapter-api'
import _ from 'lodash'
import { extractTemplate } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { collections } from '@salto-io/lowerdash'
import { FilterCreator } from '../filter'
import { BRAND_TYPE_NAME, SUPPORT_ADDRESS_TYPE_NAME } from '../constants'

const log = logger(module)
const { awu } = collections.asynciterable


const referenceEmail = ({ emailPart, brandInstances }: {
  emailPart: string
  brandInstances: Record<string, InstanceElement>
}): TemplatePart[] => {
  // emailPart should be of the form {local-part}@{subdomain}.zendesk.com.
  const splitLocalPart = emailPart.split(/@/).filter(v => !_.isEmpty(v))
  if (splitLocalPart.length !== 2) {
    return [emailPart]
  }
  const [localPart, rest] = splitLocalPart
  // zendesk subdomain cannot have a dot (.) in it.
  const splitRest = rest.split(/\./).filter(v => !_.isEmpty(v))
  if (splitRest.length < 1) {
    return [emailPart]
  }
  const subdomain = splitRest[0]
  splitRest.shift()
  const elem = brandInstances[subdomain]
  if (elem) {
    return [
      localPart,
      '@',
      new ReferenceExpression(elem.elemID.createNestedID('subdomain'), elem.value.subdomain),
      '.',
      splitRest.join('.'),
    ]
  }
  return [emailPart]
}


const getTemplateEmail = ({
  supportAddressInstance,
  brandList,
} : {
  supportAddressInstance: InstanceElement
  brandList: Record<string, InstanceElement>
}): TemplateExpression | string | undefined => {
  const originalEmail = supportAddressInstance.value.email
  if (!_.isString(originalEmail)) {
    log.error(`email of ${supportAddressInstance.elemID.getFullName()} is not a string`)
    return undefined
  }
  return extractTemplate(
    originalEmail,
    [],
    emailPart => referenceEmail({
      emailPart,
      brandInstances: brandList,
    })
  )
}

const turnEmailToTemplateExpression = (
  supportAddressInstances: InstanceElement[],
  brandBySubdomains: Record<string, InstanceElement>
): void => {
  supportAddressInstances
    .forEach(supportInstance => {
      supportInstance.value.email = getTemplateEmail({
        supportAddressInstance: supportInstance,
        brandList: brandBySubdomains,
      })
    })
}

const replaceIfReferenceExpression = (part: TemplatePart): string =>
  (isReferenceExpression(part) ? part.value : part)

const templateToEmail = (change: Change<InstanceElement>): void => {
  const inst = getChangeData(change)
  const { email } = inst.value
  if (isTemplateExpression(email)) {
    inst.value.email = email.parts.map(replaceIfReferenceExpression).join('')
  }
}

const filterCreator: FilterCreator = ({ elementsSource }) => ({
  onFetch: async (elements: Element[]): Promise<void> => {
    const instances = elements
      .filter(isInstanceElement)
    const supportAddressInstances = instances
      .filter(inst => inst.elemID.typeName === SUPPORT_ADDRESS_TYPE_NAME)
    const brandBySubdomains: Record<string, InstanceElement> = _.keyBy(
      (instances
        .filter(inst => inst.elemID.typeName === BRAND_TYPE_NAME)
        .filter(inst => inst.value.subdomain !== undefined)),
      (inst: InstanceElement): string => inst.value.subdomain
    )
    turnEmailToTemplateExpression(supportAddressInstances, brandBySubdomains)
  },
  preDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
    changes
      .filter(change => getChangeData(change).elemID.typeName === SUPPORT_ADDRESS_TYPE_NAME)
      .filter(isInstanceChange)
      .forEach(templateToEmail)
  },
  onDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
    const supportAddressInstances = changes
      .filter(isAdditionOrModificationChange)
      .filter(isInstanceChange)
      .filter(change => getChangeData(change).elemID.typeName === SUPPORT_ADDRESS_TYPE_NAME)
      .map(getChangeData)
    if (_.isEmpty(supportAddressInstances)) {
      return
    }
    const brandInstances = await awu(await elementsSource.getAll())
      .filter(isInstanceElement)
      .filter(inst => inst.elemID.typeName === BRAND_TYPE_NAME)
      .filter(inst => inst.value.subdomain !== undefined)
      .toArray()
    const brandBySubdomains: Record<string, InstanceElement> = _.keyBy(
      brandInstances,
      (inst: InstanceElement): string => inst.value.subdomain
    )
    turnEmailToTemplateExpression(supportAddressInstances, brandBySubdomains)
  },
})

export default filterCreator
