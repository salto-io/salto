/*
 * Copyright 2025 Salto Labs Ltd.
 * Licensed under the Salto Terms of Use (the "License");
 * You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
 *
 * CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
 */
import Joi from 'joi'
import { BlockBase, createBlockChecker } from '../../src/filters/cross_service/recipe_block_types'

describe('Recipe references filter', () => {
  type BlockType = BlockBase & {
    stringItem: string
    provider: 'app' | 'app_secondary'
    numberItem: number
    objectItem: {
      must: string
      could?: number
    }
  }

  let blockChecker: (value: unknown, application: string) => value is BlockType

  describe('Cross service - recipe block type - create block checker', () => {
    beforeAll(() => {
      const blockSchema = Joi.object({
        keyword: Joi.string().required(),
        provider: Joi.string().valid('app', 'app_secondary').required(),
        stringItem: Joi.string().required(),
        numberItem: Joi.number().required(),
        objectItem: Joi.object({
          must: Joi.string().required(),
          could: Joi.number(),
        })
          .unknown(true)
          .required(),
      })
        .unknown(true)
        .required()
      blockChecker = createBlockChecker<BlockType>(blockSchema, ['app', 'more_app'])
    })
    it('should accept valid block', () => {
      const block = {
        keyword: 'keyword',
        provider: 'app',
        stringItem: 'string',
        numberItem: 4,
        objectItem: {
          must: 'string',
          could: 4,
          else: 'string',
        },
      }
      expect(blockChecker(block, 'app')).toBeTruthy()
    })
    it('should reject block not in schema', () => {
      const block = {
        keyword: 'keyword',
        provider: 'app',
        stringItem: 5,
        numberItem: 4,
        objectItem: {
          must: 'string',
          could: 4,
          else: 'string',
        },
      }
      expect(blockChecker(block, 'app')).toBeFalsy()
    })
    it('should reject block of different app', () => {
      const block = {
        keyword: 'keyword',
        provider: 'not_app',
        stringItem: 'string',
        numberItem: 4,
        objectItem: {
          must: 'string',
          could: 4,
          else: 'string',
        },
      }
      expect(blockChecker(block, 'app')).toBeFalsy()
    })
  })
})
