/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { Value, InstanceElement, ElemID, ObjectType } from '@salto-io/adapter-api'
import { filterUtils, client as clientUtils } from '@salto-io/adapter-components'
import { MockInterface } from '@salto-io/test-utils'
import { getFilterParams, mockClient } from '../../../utils'
import prioritySchemeProjectAssociationFilter from '../../../../src/filters/data_center/priority_scheme/priority_scheme_project_association'
import JiraClient from '../../../../src/client/client'
import { JIRA, PROJECT_TYPE } from '../../../../src/constants'

describe('prioritySchemeProjectAssociationFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch'>
  let client: JiraClient
  let paginator: clientUtils.Paginator
  let connection: MockInterface<clientUtils.APIConnection>
  let prioritySchemeResponse: Value

  let projectInstance: InstanceElement
  let projectType: ObjectType

  beforeEach(async () => {
    const { client: cli, paginator: cliPaginator, connection: conn } = mockClient(true)
    client = cli
    paginator = cliPaginator
    connection = conn

    filter = prioritySchemeProjectAssociationFilter(
      getFilterParams({
        client,
        paginator,
      }),
    ) as filterUtils.FilterWith<'onFetch'>

    prioritySchemeResponse = {
      status: 200,
      data: {
        id: 2,
      },
    }

    projectType = new ObjectType({
      elemID: new ElemID(JIRA, PROJECT_TYPE),
    })

    projectInstance = new InstanceElement('inst', projectType, {
      id: 1,
    })

    connection.get.mockResolvedValue(prioritySchemeResponse)
  })

  describe('onFetch', () => {
    it('should fetch project priority scheme', async () => {
      await filter.onFetch([projectInstance])

      expect(projectInstance.value).toEqual({
        id: 1,
        priorityScheme: 2,
      })

      expect(connection.get).toHaveBeenCalledWith('/rest/api/2/project/1/priorityscheme', undefined)
    })

    it('should not fetch priority scheme if running in jira cloud', async () => {
      const { client: cli, paginator: cliPaginator, connection: conn } = mockClient(false)
      client = cli
      paginator = cliPaginator
      connection = conn

      filter = prioritySchemeProjectAssociationFilter(
        getFilterParams({
          client,
          paginator,
        }),
      ) as filterUtils.FilterWith<'onFetch'>

      await filter.onFetch([projectInstance])

      expect(projectInstance.value).toEqual({
        id: 1,
      })

      expect(connection.get).not.toHaveBeenCalled()
    })

    it('should do nothing if response is invalid', async () => {
      prioritySchemeResponse.data = {}

      await filter.onFetch([projectInstance])

      expect(projectInstance.value).toEqual({
        id: 1,
      })
    })
  })
})
