/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { InstanceElement } from '@salto-io/adapter-api'
import { getFieldInstanceTypes } from '../../src/data_elements/custom_fields'
import { othercustomfieldType } from '../../src/autogen/types/standard_types/othercustomfield'
import { entitycustomfieldType } from '../../src/autogen/types/standard_types/entitycustomfield'
import { itemcustomfieldType } from '../../src/autogen/types/standard_types/itemcustomfield'
import { crmcustomfieldType } from '../../src/autogen/types/standard_types/crmcustomfield'

describe('getFieldInstanceTypes', () => {
  it('Should return matching types for other custom field', () => {
    const otherCustomFieldInstance = new InstanceElement('test', othercustomfieldType().type, { rectype: '-112' })

    const relevantTypes = getFieldInstanceTypes(otherCustomFieldInstance, { '-112': ['account'] })
    expect(relevantTypes).toEqual(['account'])
  })

  it('Should return matching types for entity custom field', () => {
    const entityCustomFieldInstance = new InstanceElement('test', entitycustomfieldType().type, {
      appliestocontact: true,
      appliestocustomer: true,
      appliestoemployee: false,
      appliestopartner: true,
      appliestovendor: false,
      appliestopricelist: false,
    })
    const relevantTypes = getFieldInstanceTypes(entityCustomFieldInstance, {})
    expect(relevantTypes).toEqual(['contact', 'customer', 'partner'])
  })

  it('Should return matching types for item custom field', () => {
    const itemCustomFieldInstance = new InstanceElement('test', itemcustomfieldType().type, {
      appliestogroup: false,
      appliestoinventory: true,
      appliestoitemassembly: true,
      appliestokit: false,
      appliestononinventory: true,
      appliestoothercharge: true,
    })
    const relevantTypes = getFieldInstanceTypes(itemCustomFieldInstance, {})
    expect(relevantTypes).toEqual([
      'inventoryItem',
      'assemblyItem',
      'nonInventoryPurchaseItem',
      'nonInventorySaleItem',
      'nonInventoryResaleItem',
      'otherChargeSaleItem',
      'otherChargeResaleItem',
      'otherChargePurchaseItem',
    ])
  })

  it('Should return matching types for crm custom field', () => {
    const crmCustomFieldInstance = new InstanceElement('test', crmcustomfieldType().type, {
      appliestocampaign: true,
      appliestoprojecttask: true,
      appliestophonecall: true,
      appliestosolution: true,
      appliestotask: false,
    })
    const relevantTypes = getFieldInstanceTypes(crmCustomFieldInstance, {})
    expect(relevantTypes).toEqual(['campaign', 'projectTask', 'phoneCall', 'solution'])
  })
})
