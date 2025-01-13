/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */

import { ChangeGroupIdFunctionReturn } from '@salto-io/adapter-api'
import { mergeChangeGroupInfo } from '../../../src/core/plan/group'

describe('getCustomGroupId', () => {
  it('should do nothing for a single group info', () => {
    const groupInfo: ChangeGroupIdFunctionReturn = { changeGroupIdMap: new Map(), disjointGroups: new Set('abc') }
    expect(mergeChangeGroupInfo([groupInfo])).toMatchObject({
      disjointGroups: new Set('abc'),
    })
  })
  it('should correcly merge several group infos', () => {
    const groups1 = {
      changeGroupIdMap: new Map([
        ['A', 'A1'],
        ['B', 'B1'],
      ]),
      disjointGroups: new Set('a'),
    }
    const groups2 = { changeGroupIdMap: new Map([['C', 'C1']]), disjointGroups: new Set('bcd') }
    const groups3 = { changeGroupIdMap: new Map(), disjointGroups: new Set('be') }
    const groups4 = { changeGroupIdMap: new Map() }

    expect(mergeChangeGroupInfo([groups1, groups2, groups3, groups4])).toMatchObject({
      changeGroupIdMap: new Map([
        ['A', 'A1'],
        ['B', 'B1'],
        ['C', 'C1'],
      ]),
      disjointGroups: new Set('abcde'),
    })
  })
})
