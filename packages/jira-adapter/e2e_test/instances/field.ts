/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import { ElemID, Values, Element } from '@salto-io/adapter-api'
import { createReference } from '../utils'
import { ISSUE_TYPE_NAME, JIRA } from '../../src/constants'

const p1Option = {
  value: 'p1',
  disabled: false,
  cascadingOptions: {
    c11: {
      value: 'c11',
      disabled: false,
      position: 0,
    },
    c12: {
      value: 'c12',
      disabled: false,
      position: 1,
    },
  },
  position: 1,
}

export const createFieldValues = (name: string): Values => ({
  name,
  description: 'desc!',
  searcherKey: 'com.atlassian.jira.plugin.system.customfieldtypes:cascadingselectsearcher',
  type: 'com.atlassian.jira.plugin.system.customfieldtypes:cascadingselect',
})

export const createContextValues = (name: string, allElements: Element[]): Values => ({
  name,
  options: {
    p1: p1Option,
    p2: {
      value: 'p2',
      disabled: false,
      cascadingOptions: {
        c22: {
          value: 'c22',
          disabled: false,
          position: 0,
        },
      },
      position: 2,
    },
    p3: {
      value: 'p3',
      disabled: true,
      position: 3,
    },
    p4: {
      value: 'p4',
      disabled: false,
      position: 4,
    },
  },
  issueTypeIds: [
    createReference(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'Epic'), allElements),
    createReference(new ElemID(JIRA, ISSUE_TYPE_NAME, 'instance', 'Story'), allElements),
  ],
})
