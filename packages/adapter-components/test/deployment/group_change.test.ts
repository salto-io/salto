/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import {
  BuiltinTypes,
  Change,
  CORE_ANNOTATIONS,
  ElemID,
  getChangeData,
  InstanceElement,
  isInstanceChange,
  ObjectType,
  toChange,
} from '@salto-io/adapter-api'
import { getChangeGroupIdsFunc, ChangeIdFunction } from '../../src/deployment/grouping'

describe('getChangeGroupIdsFunc', () => {
  let type: ObjectType
  let instance: InstanceElement

  let instanceNameChangeGroupId: ChangeIdFunction
  let fullNameChangeGroupId: ChangeIdFunction
  let nothingChangeGroupId: ChangeIdFunction

  beforeEach(() => {
    type = new ObjectType({
      elemID: new ElemID('adapter', 'test'),
      fields: {
        id: { refType: BuiltinTypes.STRING },
        creatableField: {
          refType: BuiltinTypes.STRING,
          annotations: { [CORE_ANNOTATIONS.CREATABLE]: true },
        },
      },
    })

    instance = new InstanceElement('instance', type, {
      creatableField: 'creatableValue',
      ignored: 'ignored',
    })

    instanceNameChangeGroupId = async change => (!isInstanceChange(change) ? 'not Instance' : undefined)
    fullNameChangeGroupId = async change => `${getChangeData(change).elemID.getFullName()}.GROUP`
    nothingChangeGroupId = async () => undefined
  })

  it('should map changes to the group based on the function provide', async () => {
    const changeGroupIds = (
      await getChangeGroupIdsFunc([fullNameChangeGroupId])(
        new Map<string, Change>([
          [instance.elemID.getFullName(), toChange({ after: instance })],
          [type.elemID.getFullName(), toChange({ after: type })],
        ]),
      )
    ).changeGroupIdMap

    expect(changeGroupIds.get(instance.elemID.getFullName())).toEqual('adapter.test.instance.instance.GROUP')
    expect(changeGroupIds.get(type.elemID.getFullName())).toEqual('adapter.test.GROUP')
  })
  it('should map above the first defined function provide when multiple are passed', async () => {
    const changeGroupIds = (
      await getChangeGroupIdsFunc([instanceNameChangeGroupId, fullNameChangeGroupId])(
        new Map<string, Change>([
          [instance.elemID.getFullName(), toChange({ after: instance })],
          [type.elemID.getFullName(), toChange({ after: type })],
        ]),
      )
    ).changeGroupIdMap

    expect(changeGroupIds.get(instance.elemID.getFullName())).toEqual('adapter.test.instance.instance.GROUP')
    expect(changeGroupIds.get(type.elemID.getFullName())).toEqual('not Instance')
  })
  it('should map by full name when no matching function provide', async () => {
    const changeGroupIds = (
      await getChangeGroupIdsFunc([nothingChangeGroupId])(
        new Map<string, Change>([
          [instance.elemID.getFullName(), toChange({ after: instance })],
          [type.elemID.getFullName(), toChange({ after: type })],
        ]),
      )
    ).changeGroupIdMap

    expect(changeGroupIds.get(instance.elemID.getFullName())).toEqual('adapter.test.instance.instance')
    expect(changeGroupIds.get(type.elemID.getFullName())).toEqual('adapter.test')
  })
})
