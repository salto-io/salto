/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { customrecordtypeType } from '../../src/autogen/types/standard_types/customrecordtype'
import NetsuiteClient from '../../src/client/client'
import { CUSTOM_RECORD_TYPE, INTERNAL_ID, METADATA_TYPE, NETSUITE } from '../../src/constants'
import setServiceUrl from '../../src/service_url/custom_record_type'

describe('setCustomRecordTypesUrls', () => {
  const client = {
    url: 'https://accountid.app.netsuite.com',
  } as unknown as NetsuiteClient
  const customrecordtype = customrecordtypeType().type

  it('should set the right url', async () => {
    const elements = [
      new ObjectType({
        elemID: new ElemID(NETSUITE, 'customrecord1'),
        annotations: {
          [METADATA_TYPE]: CUSTOM_RECORD_TYPE,
          scriptid: 'customrecord1',
          [INTERNAL_ID]: '1',
        },
      }),
    ]
    await setServiceUrl(elements, client)
    expect(elements[0].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe(
      'https://accountid.app.netsuite.com/app/common/custom/custrecord.nl?id=1',
    )
  })

  it('should not set url if not found internal id', async () => {
    const notFoundElement = new InstanceElement('A2', customrecordtype, { scriptid: 'someScriptID2' })
    await setServiceUrl([notFoundElement], client)
    expect(notFoundElement.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
  })
})
