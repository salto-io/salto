/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import _ from 'lodash'
import { InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import { naclCase, inspectValue, ERROR_MESSAGES, getCollisionWarnings } from '@salto-io/adapter-utils'
import { logger } from '@salto-io/logging'
import { FilterCreator } from '../filter'
import { JIRA } from '../constants'

const log = logger(module)

const getInstanceName = (instance: InstanceElement): string => naclCase(`${instance.elemID.name}_${instance.value.id}`)

/**
 * Add id to the name of instances with duplicate names to prevent conflicts in the names
 *
 * This filter assumes the adapter does not split the same element into multiple files
 */
const filter: FilterCreator = ({ config }) => ({
  name: 'duplicateIdsFilter',
  onFetch: async elements => {
    const relevantInstances = elements.filter(isInstanceElement)

    const duplicateIds = new Set(
      _(relevantInstances)
        .countBy(instance => instance.elemID.getFullName())
        .pickBy(count => count > 1)
        .keys()
        .value(),
    )

    if (duplicateIds.size === 0) {
      return {}
    }

    log.warn(`Found ${duplicateIds.size} duplicate instance names: ${Array.from(duplicateIds).join(', ')}`)

    const duplicateInstances = _.remove(
      elements,
      element =>
        duplicateIds.has(element.elemID.getFullName()) && isInstanceElement(element) && element.value.id !== undefined,
    ) as InstanceElement[]

    duplicateInstances.filter(isInstanceElement).forEach(instance => {
      log.debug(
        `Found a duplicate instance ${instance.elemID.getFullName()} with values: ${inspectValue(instance.value)}`,
      )
    })

    if (!config.fetch.fallbackToInternalId) {
      const duplicateWarnings = getCollisionWarnings({
        instances: duplicateInstances,
        adapterName: _.upperFirst(JIRA),
      })
      return {
        errors: duplicateWarnings,
      }
    }

    const newInstances = duplicateInstances
      .filter(isInstanceElement)
      .filter(instance => config.apiDefinitions.typesToFallbackToInternalId.includes(instance.elemID.typeName))
      .map(
        instance =>
          new InstanceElement(
            getInstanceName(instance),
            instance.refType,
            instance.value,
            instance.path,
            instance.annotations,
          ),
      )

    const newNames = Array.from(newInstances.map(instance => instance.elemID.name))

    log.debug(`Replaced duplicate names with: ${newNames.join(', ')}`)
    elements.push(...newInstances)

    return {
      errors: [
        {
          message: ERROR_MESSAGES.ID_COLLISION,
          detailedMessage: `The following elements had duplicate names in Jira and therefore their internal id was added to their names.
It is strongly recommended to rename these instances so they are unique in Jira, then re-fetch with the "Regenerate Salto IDs" fetch option. Read more here: https://help.salto.io/en/articles/6927157-salto-id-collisions.
${newNames.join(',\n')}`,
          severity: 'Warning',
        },
      ],
    }
  },
})

export default filter
