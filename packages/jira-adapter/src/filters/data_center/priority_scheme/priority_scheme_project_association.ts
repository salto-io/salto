/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement, isInstanceElement } from '@salto-io/adapter-api'
import JiraClient from '../../../client/client'
import { PROJECT_TYPE } from '../../../constants'
import { FilterCreator } from '../../../filter'
import { isPrioritySchemeResponse } from './priority_scheme_deploy'

const getProjectPriorityScheme = async (instance: InstanceElement, client: JiraClient): Promise<number | undefined> => {
  const response = await client.get({
    url: `/rest/api/2/project/${instance.value.id}/priorityscheme`,
  })

  return isPrioritySchemeResponse(response.data) ? response.data.id : undefined
}

const filter: FilterCreator = ({ client }) => ({
  name: 'prioritySchemeProjectAssociationFilter',
  onFetch: async elements => {
    if (!client.isDataCenter) {
      return
    }

    await Promise.all(
      elements
        .filter(isInstanceElement)
        .filter(instance => instance.elemID.typeName === PROJECT_TYPE)
        .map(async instance => {
          instance.value.priorityScheme = await getProjectPriorityScheme(instance, client)
        }),
    )
  },
})

export default filter
