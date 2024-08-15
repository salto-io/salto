/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { CORE_ANNOTATIONS, InstanceElement } from '@salto-io/adapter-api'
import { customsegmentType } from '../../src/autogen/types/standard_types/customsegment'
import NetsuiteClient from '../../src/client/client'
import { INTERNAL_ID } from '../../src/constants'
import setServiceUrl from '../../src/service_url/custom_segment'

describe('setCustomRecordTypesUrls', () => {
  const client = {
    url: 'https://accountid.app.netsuite.com',
  } as unknown as NetsuiteClient
  const customsegment = customsegmentType().type

  it('should set the right url', async () => {
    const elements = [new InstanceElement('B', customsegment, { scriptid: 'cseg1', [INTERNAL_ID]: '2' })]
    await setServiceUrl(elements, client)
    expect(elements[0].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe(
      'https://accountid.app.netsuite.com/app/common/custom/segments/segment.nl?id=2',
    )
  })

  it('should not set url if not found internal id', async () => {
    const notFoundElement = new InstanceElement('A2', customsegment, { scriptid: 'cseg2' })
    await setServiceUrl([notFoundElement], client)
    expect(notFoundElement.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
  })
})
