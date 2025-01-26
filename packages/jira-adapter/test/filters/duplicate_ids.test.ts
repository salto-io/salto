/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import _ from 'lodash'
import { getFilterParams } from '../utils'
import duplicateIdsFilter from '../../src/filters/duplicate_ids'
import { Filter } from '../../src/filter'
import { getDefaultConfig, JiraConfig } from '../../src/config/config'
import { JIRA, STATUS_TYPE_NAME } from '../../src/constants'

describe('duplicateIdsFilter', () => {
  let filter: Filter
  let type: ObjectType
  let config: JiraConfig
  beforeEach(async () => {
    config = _.cloneDeep(getDefaultConfig({ isDataCenter: false }))

    config.fetch.fallbackToInternalId = true

    filter = duplicateIdsFilter(
      getFilterParams({
        config,
      }),
    )

    type = new ObjectType({
      elemID: new ElemID(JIRA, STATUS_TYPE_NAME),
    })
  })

  describe('onFetch', () => {
    it('should add id to duplicate instances name', async () => {
      const dup1 = new InstanceElement('dup', type, {
        id: '1',
        name: 'dup',
      })
      const dup2 = new InstanceElement('dup', type, {
        id: '2',
      })

      const notDup = new InstanceElement('notDup', type, {
        id: '1',
        name: 'notDup',
      })

      const elements = [notDup, dup1, dup2]
      const filterRes = await filter.onFetch?.(elements)
      expect(elements.map(e => e.elemID.name)).toEqual(['notDup', 'dup_1', 'dup_2'])
      expect(filterRes).toEqual({
        errors: [
          {
            message: 'Some elements were not fetched due to Salto ID collisions',
            detailedMessage:
              'The following elements had duplicate names in Jira and therefore their internal id was added to their names.\nIt is strongly recommended to rename these instances so they are unique in Jira, then re-fetch with the "Regenerate Salto IDs" fetch option. Read more here: https://help.salto.io/en/articles/6927157-salto-id-collisions.\ndup_1,\ndup_2',
            severity: 'Warning',
          },
        ],
      })
    })

    it('should do nothing if there is no id', async () => {
      const dup1 = new InstanceElement('dup', type, {
        name: 'dup',
      })
      const dup2 = new InstanceElement('dup', type, {
        name: 'dup',
      })

      const elements = [dup1, dup2]
      await filter.onFetch?.(elements)
      expect(elements.map(e => e.elemID.name)).toEqual(['dup', 'dup'])
    })
  })

  it('should only remove the duplicates if typesToFallbackToInternalId is empty', async () => {
    config.apiDefinitions.typesToFallbackToInternalId = []
    const dup1 = new InstanceElement('dup', type, {
      id: '1',
      name: 'dup',
    })
    const dup2 = new InstanceElement('dup', type, {
      id: '2',
      name: 'dup',
    })

    const elements = [dup1, dup2]
    await filter.onFetch?.(elements)
    expect(elements).toHaveLength(0)
  })

  it('should only remove the duplicates if fallbackToInternalId is false', async () => {
    config.fetch.fallbackToInternalId = false
    const instance = new InstanceElement('dup', type, {
      id: '1',
      name: 'dup',
    })
    const instanceDuplicatedName = new InstanceElement('dup', type, {
      id: '2',
      name: 'dup',
    })
    const instanceWithAlias = new InstanceElement(
      'dup',
      type,
      {
        id: '1',
        name: 'dup',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.ALIAS]: ['instance alias'],
        [CORE_ANNOTATIONS.SERVICE_URL]: ['https://dup_1_someurl.com'],
      },
    )
    const instanceWithAliasDuplicatedName = new InstanceElement(
      'dup',
      type,
      {
        id: '2',
        name: 'dup',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.ALIAS]: ['another instance alias'],
        [CORE_ANNOTATIONS.SERVICE_URL]: ['https://dup_2_someurl.com'],
      },
    )
    const instanceWithAliasDuplicatedNameDuplicateAlias = new InstanceElement(
      'dup',
      type,
      {
        id: '2',
        name: 'dup',
      },
      undefined,
      {
        [CORE_ANNOTATIONS.ALIAS]: ['instance alias'],
      },
    )

    const elements = [
      instance,
      instanceDuplicatedName,
      instanceWithAlias,
      instanceWithAliasDuplicatedName,
      instanceWithAliasDuplicatedNameDuplicateAlias,
    ]
    const filterRes = await filter.onFetch?.(elements)
    expect(elements).toHaveLength(0)

    expect(filterRes).toEqual({
      errors: [
        {
          message: 'Some elements were not fetched due to Salto ID collisions',
          detailedMessage: `5 Jira elements were not fetched, as they were mapped to a single ID jira.Status.instance.dup:
dup,
dup,
instance alias - open in Jira: https://dup_1_someurl.com,
another instance alias - open in Jira: https://dup_2_someurl.com,
instance alias .

Usually, this happens because of duplicate configuration names in the service. Make sure these element names are unique, and try fetching again.
Learn about additional ways to resolve this issue at https://help.salto.io/en/articles/6927157-salto-id-collisions .`,
          severity: 'Warning',
        },
      ],
    })
  })
})
