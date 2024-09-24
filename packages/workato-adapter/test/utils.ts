/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { buildElementsSourceFromElements } from '@salto-io/adapter-utils'
import {
  client as clientUtils,
  elements as elementUtils,
  definitions as definitionsUtils,
} from '@salto-io/adapter-components'
import { mockFunction, MockInterface } from '@salto-io/test-utils'
import { InstanceElement, ElemID, ObjectType } from '@salto-io/adapter-api'
import { adapter } from '../src/adapter_creator'
import WorkatoClient from '../src/client/client'
import { FilterCreator } from '../src/filter'
import { Credentials } from '../src/auth'
import { DEFAULT_CONFIG, WorkatoUserConfig } from '../src/user_config'
import { WorkatoOptions } from '../src/definitions/types'
import { createClientDefinitions } from '../src/definitions/requests/clients'
import { PAGINATION } from '../src/definitions/requests/pagination'
import { createFetchDefinitions } from '../src/definitions/fetch/fetch'
import fetchCriteria from '../src/fetch_criteria'

export const createCredentialsInstance = (credentials: Credentials): InstanceElement =>
  new InstanceElement(ElemID.CONFIG_NAME, adapter.authenticationMethods.basic.credentialsType, credentials)

export const createConfigInstance = (config: WorkatoUserConfig): InstanceElement =>
  new InstanceElement(ElemID.CONFIG_NAME, adapter.configType as ObjectType, config)

const mockConnection = (): MockInterface<clientUtils.APIConnection> => ({
  get: mockFunction<clientUtils.APIConnection['get']>().mockResolvedValue({ status: 200, data: '' }),
  head: mockFunction<clientUtils.APIConnection['head']>().mockResolvedValue({ status: 200, data: '' }),
  options: mockFunction<clientUtils.APIConnection['options']>().mockResolvedValue({ status: 200, data: '' }),
  post: mockFunction<clientUtils.APIConnection['post']>().mockResolvedValue({ status: 200, data: '' }),
  put: mockFunction<clientUtils.APIConnection['put']>().mockResolvedValue({ status: 200, data: '' }),
  delete: mockFunction<clientUtils.APIConnection['delete']>().mockResolvedValue({ status: 200, data: '' }),
  patch: mockFunction<clientUtils.APIConnection['patch']>().mockResolvedValue({ status: 200, data: '' }),
})

type ClientWithMockConnection = {
  client: WorkatoClient
  connection: MockInterface<clientUtils.APIConnection>
}
export const mockClient = (): ClientWithMockConnection => {
  const connection = mockConnection()
  const client = new WorkatoClient({
    credentials: {
      token: 'test',
    },
    connection: {
      login: async () => ({
        ...connection,
        accountInfo: {
          accountId: '',
        },
      }),
    },
  })
  return { client, connection }
}

export const createFetchQuery = (config?: WorkatoUserConfig): elementUtils.query.ElementQuery =>
  elementUtils.query.createElementQuery(config?.fetch ?? DEFAULT_CONFIG?.fetch, fetchCriteria)

export const createDefinitions = (): definitionsUtils.RequiredDefinitions<WorkatoOptions> => {
  const cli = mockClient().client
  return {
    clients: createClientDefinitions({ main: cli }),
    pagination: PAGINATION,
    fetch: createFetchDefinitions(DEFAULT_CONFIG),
  }
}

export const getFilterParams = (params?: Partial<Parameters<FilterCreator>[0]>): Parameters<FilterCreator>[0] => ({
  definitions: createDefinitions(),
  config: DEFAULT_CONFIG,
  elementSource: buildElementsSourceFromElements([]),
  fetchQuery: createFetchQuery(params?.config),
  sharedContext: {},
  ...(params ?? {}),
})
