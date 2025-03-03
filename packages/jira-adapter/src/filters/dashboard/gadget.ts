/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  BuiltinTypes,
  ElemID,
  Field,
  getChangeData,
  InstanceElement,
  isAdditionOrModificationChange,
  isInstanceChange,
  isInstanceElement,
  isRemovalChange,
  ObjectType,
  Element,
  Value,
} from '@salto-io/adapter-api'
import { logger } from '@salto-io/logging'
import { getParents, safeJsonStringify } from '@salto-io/adapter-utils'
import { client as clientUtils, elements as adapterElements } from '@salto-io/adapter-components'
import _ from 'lodash'
import { collections, promises } from '@salto-io/lowerdash'
import { FilterCreator } from '../../filter'
import {
  CONTENT_TYPE_HEADER,
  DASHBOARD_GADGET_PROPERTIES_CONFIG_TYPE,
  DASHBOARD_GADGET_PROPERTIES_TYPE,
  DASHBOARD_GADGET_TYPE,
  JIRA,
  JSON_CONTENT_TYPE,
} from '../../constants'
import JiraClient from '../../client/client'
import { defaultDeployChange, deployChanges } from '../../deployment/standard_deployment'
import { findObject, setFieldDeploymentAnnotations } from '../../utils'

const log = logger(module)
const { awu } = collections.asynciterable

export type InstantToPropertiesResponse = {
  instance: InstanceElement
  promisePropertyValues: Promise<Record<string, Promise<Value>>>
}

const getSubTypes = (): {
  configType: ObjectType
  propertiesType: ObjectType
} => {
  const configType = new ObjectType({
    elemID: new ElemID(JIRA, DASHBOARD_GADGET_PROPERTIES_CONFIG_TYPE),
    fields: {
      statType: { refType: BuiltinTypes.STRING },
    },
    path: [JIRA, adapterElements.TYPES_PATH, adapterElements.SUBTYPES_PATH, DASHBOARD_GADGET_PROPERTIES_CONFIG_TYPE],
  })
  const propertiesType = new ObjectType({
    elemID: new ElemID(JIRA, DASHBOARD_GADGET_PROPERTIES_TYPE),
    fields: {
      config: { refType: configType },
    },
    path: [JIRA, adapterElements.TYPES_PATH, adapterElements.SUBTYPES_PATH, DASHBOARD_GADGET_PROPERTIES_TYPE],
  })
  return { configType, propertiesType }
}

const deployGadgetProperties = async (instance: InstanceElement, client: JiraClient): Promise<void> => {
  // references are already resolved
  const dashboardId = getParents(instance)[0].id

  await Promise.all(
    Object.entries(instance.value.properties ?? {}).map(([key, value]) =>
      client.put({
        url: `/rest/api/3/dashboard/${dashboardId}/items/${instance.value.id}/properties/${key}`,
        // Axios has a weird behavior when converting the value to json
        // where a value of '"false"' will be converted to false instead of "false"
        // so we use json stringify here
        data: safeJsonStringify(value),
        headers: {
          // value can be a string and in that case axios won't send
          // this header so we need to add it
          [CONTENT_TYPE_HEADER]: JSON_CONTENT_TYPE,
        },
      }),
    ),
  )
}

const getPropertiesKeys = async (instance: InstanceElement, client: JiraClient): Promise<string[]> => {
  const dashboardId = getParents(instance)[0].value.value.id

  try {
    const response = await client.get({
      url: `/rest/api/3/dashboard/${dashboardId}/items/${instance.value.id}/properties`,
    })
    if (Array.isArray(response.data) || !Array.isArray(response.data.keys)) {
      log.error(
        `Invalid response from server when fetching property keys for ${instance.elemID.getFullName()}: ${safeJsonStringify(response.data)}`,
      )
      return []
    }

    return response.data.keys.map(key => key.key).filter(key => !_.isEmpty(key))
  } catch (err) {
    log.warn(`Failed to fetch properties for ${instance.elemID.getFullName()}: ${err}`)
    return []
  }
}

const getPropertyValue = async (instance: InstanceElement, key: string, client: JiraClient): Promise<Value> => {
  const dashboardId = getParents(instance)[0].value.value.id

  try {
    const response = await client.get({
      url: `/rest/api/3/dashboard/${dashboardId}/items/${instance.value.id}/properties/${key}`,
    })

    if (Array.isArray(response.data)) {
      log.error(
        `Invalid response from server when fetching property '${key}' value for ${instance.elemID.getFullName()}: ${safeJsonStringify(response.data)}`,
      )
      return undefined
    }

    return response.data.value
  } catch (err) {
    log.warn(`Failed to fetch property '${key}' value for ${instance.elemID.getFullName()}: ${err}`)
    return undefined
  }
}

const getAPIResponse = async (
  client: JiraClient,
  instance: InstanceElement,
): Promise<Record<string, Promise<Value>>> => {
  const keys = await getPropertiesKeys(instance, client)
  return Object.fromEntries(keys.map(key => [key, getPropertyValue(instance, key, client)]))
}

export const getDashboardPropertiesAsync = (client: JiraClient, elements: Element[]): InstantToPropertiesResponse[] =>
  elements
    .filter(isInstanceElement)
    .filter(instance => instance.elemID.typeName === DASHBOARD_GADGET_TYPE)
    .map(instance => ({
      instance,
      promisePropertyValues: getAPIResponse(client, instance),
    }))

const filter: FilterCreator = ({ client, config, adapterContext }) => ({
  name: 'gadgetFilter',
  onFetch: async elements => {
    const instantsToPropertiesResponse: InstantToPropertiesResponse[] = adapterContext.dashboardPropertiesPromise

    const { configType, propertiesType } = getSubTypes()

    await awu(instantsToPropertiesResponse).forEach(async ({ instance, promisePropertyValues }) => {
      const propertyValues = await promises.object.resolveValues(await promisePropertyValues)
      instance.value.properties = adapterElements.removeNullValues({
        values: propertyValues,
        type: propertiesType,
        allowEmptyArrays: true,
        allowExistingEmptyObjects: true,
      })
    })

    const gadgetType = findObject(elements, DASHBOARD_GADGET_TYPE)
    if (gadgetType === undefined) {
      log.warn(`${DASHBOARD_GADGET_TYPE} type not found`)
      return
    }
    gadgetType.fields.properties = new Field(gadgetType, 'properties', propertiesType)
    elements.push(configType, propertiesType)
    setFieldDeploymentAnnotations(gadgetType, 'properties')
  },

  deploy: async changes => {
    const [relevantChanges, leftoverChanges] = _.partition(
      changes,
      change => isInstanceChange(change) && getChangeData(change).elemID.typeName === DASHBOARD_GADGET_TYPE,
    )

    const deployResult = await deployChanges(relevantChanges.filter(isInstanceChange), async change => {
      try {
        await defaultDeployChange({
          change,
          client,
          apiDefinitions: config.apiDefinitions,
          fieldsToIgnore: ['properties'],
        })
      } catch (err) {
        if (err instanceof clientUtils.HTTPError && err.response.status === 404 && isRemovalChange(change)) {
          return
        }
        throw err
      }

      if (isAdditionOrModificationChange(change)) {
        await deployGadgetProperties(getChangeData(change), client)
      }
    })

    return {
      leftoverChanges,
      deployResult,
    }
  },
})

export default filter
