/*
Copyright 2024 Salto Labs Ltd.
Licensed under the Salto Terms of Use (the "License");
You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use

CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, InstanceElement, ObjectType, Element } from '@salto-io/adapter-api'
import { roleType } from '../../src/autogen/types/standard_types/role'
import { financiallayoutType } from '../../src/type_parsers/financial_layout_parsing/parsed_financial_layout'
import NetsuiteClient from '../../src/client/client'
import setServiceUrl from '../../src/service_url/constant_urls'
import { NETSUITE } from '../../src/constants'

describe('setConstantUrls', () => {
  const originalUrl = 'https://someUrl.com'
  const client = {
    url: 'https://tstdrv2259448.app.netsuite.com',
  } as unknown as NetsuiteClient
  const role = roleType().type
  const financiallayout = financiallayoutType().type
  const objectTypeWithUrl = new ObjectType({
    elemID: new ElemID(NETSUITE, 'center'),
    fields: {
      name: { refType: BuiltinTypes.SERVICE_ID },
    },
    annotations: {
      [CORE_ANNOTATIONS.SERVICE_URL]: originalUrl,
    },
  })
  const instanceWithUrl = new InstanceElement('testInstance', new ObjectType(objectTypeWithUrl), {}, undefined, {
    [CORE_ANNOTATIONS.SERVICE_URL]: originalUrl,
  })
  const layoutInstance = new InstanceElement('test', financiallayout)

  let elements: Element[]

  beforeEach(() => {
    elements = [role, layoutInstance]
  })

  it('should set the right url', async () => {
    await setServiceUrl(elements, client)
    expect(elements[0].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBe(
      'https://tstdrv2259448.app.netsuite.com/app/setup/rolelist.nl',
    )
    expect(elements[1].annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(
      new URL('/app/reporting/financiallayouts.nl', client.url).href,
    )
  })

  it('should not set url if not found internal id', async () => {
    const notFoundElement = new ObjectType({ elemID: new ElemID(NETSUITE, 'someType') })
    await setServiceUrl([notFoundElement], client)
    expect(notFoundElement.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toBeUndefined()
  })

  it('should not change url if it already exists', async () => {
    await setServiceUrl([instanceWithUrl], client)
    expect(instanceWithUrl.annotations[CORE_ANNOTATIONS.SERVICE_URL]).toEqual(originalUrl)
  })
})
