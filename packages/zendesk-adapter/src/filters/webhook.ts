/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import {
  Change,
  Element,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isModificationChange,
  isInstanceElement,
  ReferenceExpression,
  isInstanceChange,
  TemplateExpression,
  isTemplateExpression,
} from '@salto-io/adapter-api'
import { applyFunctionToChangeData, createSaltoElementError, extractTemplate } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { deployChange, deployChanges } from '../deployment'
import { BRAND_TYPE_NAME, WEBHOOK_TYPE_NAME } from '../constants'
import { DOMAIN_REGEX } from './utils'
import { replaceIfReferenceExpression } from './support_address'

const log = logger(module)

const SUBDOMAIN_REGEX = /(https:\/\/)([^\\.]+)/

export const AUTH_TYPE_TO_PLACEHOLDER_AUTH_DATA: Record<string, unknown> = {
  bearer_token: { token: '123456' },
  basic_auth: { username: 'user@name.com', password: 'password' },
  api_key: { name: 'tempHeader', value: 'tempValue' },
}

const turnEndpointToTemplateExpression = ({
  instance,
  brandByUrl,
  brandBySubdomain,
}: {
  instance: InstanceElement
  brandByUrl: Record<string, InstanceElement>
  brandBySubdomain: Record<string, InstanceElement>
}): void => {
  const { endpoint } = instance.value
  if (!_.isString(endpoint)) {
    log.error(`endpoint of ${instance.elemID.getFullName()} is not a string`)
    return
  }

  instance.value.endpoint = extractTemplate(endpoint, [DOMAIN_REGEX], urlPart => {
    const urlDomain = urlPart.match(DOMAIN_REGEX)?.pop()
    if (urlDomain !== undefined) {
      const brand = brandByUrl[urlDomain]
      if (brand !== undefined) {
        return [new ReferenceExpression(brand.elemID.createNestedID('brand_url'), brand.value.brand_url)]
      }
    }
    const urlSubdomainSplit = urlPart.split(SUBDOMAIN_REGEX).filter(part => !_.isEmpty(part))
    // ['https//', 'subdomain', '.com]
    if (urlSubdomainSplit.length !== 3) {
      return urlPart
    }
    const urlSubdomain = urlSubdomainSplit[1]
    if (urlSubdomain !== undefined) {
      const brand = brandBySubdomain[urlSubdomain]
      if (brand !== undefined) {
        return [
          urlSubdomainSplit[0],
          new ReferenceExpression(brand.elemID.createNestedID('subdomain'), brand.value.subdomain),
          urlSubdomainSplit[2],
        ]
      }
    }
    return urlPart
  })
}

const templateToEndpoint = (
  change: Change<InstanceElement>,
  deployTemplateMapping: Record<string, TemplateExpression>,
): void => {
  const instance = getChangeData(change)
  const { endpoint } = instance.value
  deployTemplateMapping[instance.elemID.getFullName()] = endpoint
  if (isTemplateExpression(endpoint)) {
    instance.value.endpoint = endpoint.parts.map(replaceIfReferenceExpression).join('')
  }
}

/**
 * onFetch and in onDeploy: this filter turns the endpoint in webhook to a template expression with a reference
 * to the brand's brand_url. In preDeploy the template expressions are turned back to string.
 * deploy: Removes the authentication data from webhook if it wasn't changed
 */
const filterCreator: FilterCreator = ({ oldApiDefinitions, client }) => {
  const deployTemplateMapping: Record<string, TemplateExpression> = {}
  return {
    name: 'webhookFilter',
    onFetch: async (elements: Element[]): Promise<void> => {
      const instances = elements.filter(isInstanceElement)
      const webhookInstances = instances.filter(inst => inst.elemID.typeName === WEBHOOK_TYPE_NAME)
      const brandInstances = instances.filter(inst => inst.elemID.typeName === BRAND_TYPE_NAME)
      const brandByUrl: Record<string, InstanceElement> = _.keyBy(
        brandInstances.filter(inst => inst.value.brand_url !== undefined),
        (inst: InstanceElement): string => inst.value.brand_url,
      )
      const brandBySubdomain: Record<string, InstanceElement> = _.keyBy(
        brandInstances.filter(inst => inst.value.subdomain !== undefined),
        (inst: InstanceElement): string => inst.value.subdomain,
      )
      webhookInstances.forEach(webhookInstance => {
        turnEndpointToTemplateExpression({
          instance: webhookInstance,
          brandByUrl,
          brandBySubdomain,
        })
      })
    },
    preDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
      changes
        .filter(change => getChangeData(change).elemID.typeName === WEBHOOK_TYPE_NAME)
        .filter(isInstanceChange)
        .forEach(change => templateToEndpoint(change, deployTemplateMapping))
    },
    onDeploy: async (changes: Change<InstanceElement>[]): Promise<void> => {
      changes
        .filter(isAdditionOrModificationChange)
        .filter(isInstanceChange)
        .filter(change => getChangeData(change).elemID.typeName === WEBHOOK_TYPE_NAME)
        .map(getChangeData)
        .forEach(inst => {
          inst.value.endpoint = deployTemplateMapping[inst.elemID.getFullName()]
        })
    },
    deploy: async (changes: Change<InstanceElement>[]) => {
      const [webhookModificationChanges, leftoverChanges] = _.partition(
        changes,
        change => getChangeData(change).elemID.typeName === WEBHOOK_TYPE_NAME && isAdditionOrModificationChange(change),
      )
      const deployResult = await deployChanges(webhookModificationChanges, async change => {
        const clonedChange = await applyFunctionToChangeData(change, inst => inst.clone())
        const instance = getChangeData(clonedChange)
        if (isModificationChange(clonedChange)) {
          if (_.isEqual(clonedChange.data.before.value.authentication, clonedChange.data.after.value.authentication)) {
            delete instance.value.authentication
          } else if (instance.value.authentication === undefined) {
            instance.value.authentication = null
          }

          // Only verify the absence of custom headers if after webhook custom headers contains difference.
          // The PATCH which is a merge behaviour which relies on explicit null value to remove.
          if (!_.isEqual(clonedChange.data.before.value.custom_headers, instance.value.custom_headers)) {
            // Remove any custom headers which no longer needed in after webhook by setting value as null
            _.forEach(_.keys(clonedChange.data.before.value.custom_headers), key => {
              if (!_.has(instance.value.custom_headers, key)) {
                _.set(instance.value, ['custom_headers', key], null)
              }
            })
          }
        }

        if (instance.value.authentication) {
          const placeholder = AUTH_TYPE_TO_PLACEHOLDER_AUTH_DATA[instance.value.authentication.type]
          if (placeholder === undefined) {
            const message = `Unknown auth type was found for webhook: ${instance.value.authentication.type}`
            throw createSaltoElementError({
              // caught by deployChanges
              message,
              detailedMessage: message,
              severity: 'Error',
              elemID: getChangeData(change).elemID,
            })
          }
          instance.value.authentication.data = placeholder
        }
        // Ignore external_source because it is impossible to deploy, the user was warned at externalSourceWebhook.ts
        await deployChange(clonedChange, client, oldApiDefinitions, ['external_source'])
        getChangeData(change).value.id = getChangeData(clonedChange).value.id
      })
      return { deployResult, leftoverChanges }
    },
  }
}

export default filterCreator
