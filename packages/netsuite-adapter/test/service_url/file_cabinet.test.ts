/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, InstanceElement } from '@salto-io/adapter-api'
import { getFileCabinetTypes } from '../../src/types/file_cabinet_types'
import NetsuiteClient from '../../src/client/client'
import setServiceUrl from '../../src/service_url/file_cabinet'
import { INTERNAL_ID } from '../../src/constants'

describe('setFileCabinetUrls', () => {
  const client = {
    url: 'https://accountid.app.netsuite.com',
  } as unknown as NetsuiteClient
  const { file, folder } = getFileCabinetTypes()

  const elements = [
    new InstanceElement('A', file, { path: '/path/A', [INTERNAL_ID]: '1' }),
    new InstanceElement('B', folder, { path: '/path/B', [INTERNAL_ID]: '2' }),
    new InstanceElement('C', folder, { path: '/path/C' }),
  ]

  it('should set the right url', async () => {
    await setServiceUrl(elements, client)
    expect(elements[0].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe(
      'https://accountid.app.netsuite.com/app/common/media/mediaitem.nl?id=1',
    )
    expect(elements[1].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe(
      'https://accountid.app.netsuite.com/app/common/media/mediaitemfolder.nl?id=2',
    )
  })

  it('should not set url if not found internal id', async () => {
    await setServiceUrl(elements, client)
    expect(elements[2].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
  })
})
