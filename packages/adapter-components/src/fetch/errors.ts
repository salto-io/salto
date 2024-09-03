/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { SaltoError } from '@salto-io/adapter-api'
import { FatalError } from '@salto-io/dag'
import { HTTPError } from '../client'
import { fetch } from '../definitions'

export class AbortFetchOnFailure extends FatalError {
  constructor({ adapterName, typeName, message }: { adapterName: string; typeName: string; message: string }) {
    super(`Aborting fetch due to error in ${adapterName}:${typeName}: ${message}`)
  }
}

export const getInsufficientPermissionsError = (typeName: string): SaltoError => ({
  message: `Salto could not access the ${typeName} resource. Elements from that type were not fetched. Please make sure that this type is enabled in your service, and that the supplied user credentials have sufficient permissions to access this data. You can also exclude this data from Salto's fetches by changing the environment configuration. Learn more at https://help.salto.io/en/articles/6947061-salto-could-not-access-the-resource`,
  severity: 'Info',
})

export const createGetInsufficientPermissionsErrorFunction: (
  statuses: number[],
) => fetch.FetchResourceDefinition['onError'] = statuses => ({
  custom:
    () =>
    ({ error, typeName }) => {
      if (error instanceof HTTPError && statuses.includes(error.response.status)) {
        const message = `Salto could not access the ${typeName} resource. Elements from that type were not fetched. Please make sure that this type is enabled in your service, and that the supplied user credentials have sufficient permissions to access this data. You can also exclude this data from Salto's fetches by changing the environment configuration. Learn more at https://help.salto.io/en/articles/6947061-salto-could-not-access-the-resource`
        return {
          action: 'customSaltoError',
          value: getInsufficientPermissionsError(typeName),
        }
      }
      return { action: 'failEntireFetch', value: false }
    },
  // TODO SALTO-6004 remove
  // this is a workaround to overcome types checker, the "custom" function is applied any other values are ignored
  action: 'failEntireFetch',
  value: false,
})
