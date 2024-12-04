/*
 * Copyright 2024 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, InstanceElement, ObjectType } from '@salto-io/adapter-api'
import { Change, toChange } from '../../../adapter-api/src/change'
import { defaultSupportAddressValidator } from '../../src/change_validators'
import { ZENDESK, SUPPORT_ADDRESS_TYPE_NAME } from '../../src/constants'

const createChangesWithElements = (instances: InstanceElement[]): Change[] => {
  const change = instances.map(instance => toChange({ after: instance }))
  return change
}

const createInstance = (
  name: string,
  forwardingStatus: string,
  defaultVal?: boolean,
  typeName?: string,
): InstanceElement =>
  new InstanceElement(name, new ObjectType({ elemID: new ElemID(ZENDESK, typeName ?? SUPPORT_ADDRESS_TYPE_NAME[0]) }), {
    name,
    forwarding_status: forwardingStatus,
    default: defaultVal,
  })
const createInstanceNoDefault = (name: string, forwardingStatus: string, typeName?: string): InstanceElement =>
  new InstanceElement(name, new ObjectType({ elemID: new ElemID(ZENDESK, typeName ?? SUPPORT_ADDRESS_TYPE_NAME[0]) }), {
    name,
    forwarding_status: forwardingStatus,
  })

describe('defaultSupportAddressValidator', () => {
  it('should return an error when default is true and forward_status is not verified', async () => {
    const err = await defaultSupportAddressValidator(
      createChangesWithElements([createInstance('inst', 'failed', true, SUPPORT_ADDRESS_TYPE_NAME)]),
    )
    expect((await err[0]).severity).toEqual('Error')
  })
  it('should return no errors when default is true and forward_status is verified', async () => {
    const errs = await defaultSupportAddressValidator(
      createChangesWithElements([createInstance('inst', 'verified', true)]),
    )
    expect(errs).toEqual([])
  })
  it('should return no errors when there is no default and forward is not verified', async () => {
    const errs = await defaultSupportAddressValidator(
      createChangesWithElements([createInstanceNoDefault('inst', 'failed')]),
    )
    expect(errs).toEqual([])
  })
  it('should return no errors when there is no default and forward is verified', async () => {
    const errs = await defaultSupportAddressValidator(
      createChangesWithElements([createInstanceNoDefault('inst', 'verified')]),
    )
    expect(errs).toEqual([])
  })
  it('should return no errors when type_name is not in the types list', async () => {
    const errs = await defaultSupportAddressValidator(
      createChangesWithElements([createInstance('inst', 'failed', true, 'Settings')]),
    )
    expect(errs).toEqual([])
  })
})
