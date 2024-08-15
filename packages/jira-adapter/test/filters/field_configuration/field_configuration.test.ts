/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/
import { BuiltinTypes, CORE_ANNOTATIONS, ElemID, ListType, ObjectType } from '@salto-io/adapter-api'
import { filterUtils } from '@salto-io/adapter-components'
import { JIRA } from '../../../src/constants'
import fieldConfigurationFilter from '../../../src/filters/field_configuration/field_configuration'
import { getFilterParams } from '../../utils'

describe('fieldConfigurationFilter', () => {
  let filter: filterUtils.FilterWith<'onFetch' | 'deploy'>
  let fieldConfigurationType: ObjectType
  let fieldConfigurationItemType: ObjectType

  beforeEach(async () => {
    filter = fieldConfigurationFilter(getFilterParams()) as typeof filter

    fieldConfigurationItemType = new ObjectType({
      elemID: new ElemID(JIRA, 'FieldConfigurationItem'),
      fields: {
        id: { refType: BuiltinTypes.NUMBER },
        description: { refType: BuiltinTypes.STRING },
        isHidden: { refType: BuiltinTypes.BOOLEAN },
        isRequired: { refType: BuiltinTypes.BOOLEAN },
        renderer: { refType: BuiltinTypes.STRING },
      },
    })

    fieldConfigurationType = new ObjectType({
      elemID: new ElemID(JIRA, 'FieldConfiguration'),
      fields: {
        fields: { refType: new ListType(fieldConfigurationItemType) },
      },
    })
  })

  describe('onFetch', () => {
    it('should add deployment annotations to FieldConfiguration', async () => {
      await filter.onFetch([fieldConfigurationType])
      expect(fieldConfigurationType.fields.fields.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })

    it('should add deployment annotations to FieldConfigurationItem', async () => {
      await filter.onFetch([fieldConfigurationItemType])
      expect(fieldConfigurationItemType.fields.id.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(fieldConfigurationItemType.fields.description.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(fieldConfigurationItemType.fields.isHidden.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(fieldConfigurationItemType.fields.isRequired.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })

      expect(fieldConfigurationItemType.fields.renderer.annotations).toEqual({
        [CORE_ANNOTATIONS.CREATABLE]: true,
        [CORE_ANNOTATIONS.UPDATABLE]: true,
      })
    })
  })
})
