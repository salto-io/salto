/*
* Copyright 2024 Salto Labs Ltd.
* Licensed under the Salto Terms of Use (the "License");
* You may not use this file except in compliance with the License.  You may obtain a copy of the License at https://www.salto.io/terms-of-use
*
* CERTAIN THIRD PARTY SOFTWARE MAY BE CONTAINED IN PORTIONS OF THE SOFTWARE. See NOTICE FILE AT https://github.com/salto-io/salto/blob/main/NOTICES
*/

import { executeWithPolling, HTTPError, Response, ResponseValue } from '../../src/client'

describe('polling', () => {
  describe('executeWithPolling', () => {
    const polling = {
      checkStatus: (response: Response<ResponseValue | ResponseValue[]>): boolean => response.status === 200,
      retries: 3,
      interval: 100,
      retryOnStatus: [400],
    }
    it('should call the singleClientCall few times function and return its response', async () => {
      const singleClientCall = jest
        .fn()
        .mockResolvedValueOnce(
          Promise.resolve({
            data: 'still polling',
            status: 201,
          }),
        )
        .mockResolvedValueOnce(
          Promise.resolve({
            data: 'still polling',
            status: 201,
          }),
        )
        .mockResolvedValueOnce(
          Promise.resolve({
            data: 'done polling',
            status: 200,
          }),
        )
      const response = await executeWithPolling<string>('args', polling, singleClientCall)
      expect(singleClientCall).toHaveBeenCalledTimes(3)
      expect(singleClientCall).toHaveBeenCalledWith('args')
      expect(response).toEqual({ data: 'done polling', status: 200 })
    })
    it('should throw an error if polling fails', async () => {
      const singleClientCall = jest
        .fn()
        .mockResolvedValue({
          data: 'still polling',
          status: 201,
        })
        .mockResolvedValue({
          data: 'still polling',
          status: 201,
        })
        .mockResolvedValue({
          data: 'still polling',
          status: 201,
        })

      await expect(executeWithPolling<string>('args', polling, singleClientCall)).rejects.toThrow()
    })
    it('should retry on retryOnStatus and return the response', async () => {
      const singleClientCall = jest
        .fn()
        .mockRejectedValueOnce(
          new HTTPError('Not Found', {
            data: {},
            status: 400,
          }),
        )
        .mockResolvedValue({
          data: 'done polling',
          status: 200,
        })
      const response = await executeWithPolling<string>('args', polling, singleClientCall)
      expect(singleClientCall).toHaveBeenCalledTimes(2)
      expect(singleClientCall).toHaveBeenCalledWith('args')
      expect(response).toEqual({ data: 'done polling', status: 200 })
    })
    it('should throw an error if polling fails after retrying', async () => {
      const singleClientCall = jest
        .fn()
        .mockRejectedValueOnce(
          new HTTPError('Not Found', {
            data: {},
            status: 400,
          }),
        )
        .mockRejectedValueOnce(
          new HTTPError('Not Found', {
            data: {},
            status: 400,
          }),
        )
        .mockRejectedValueOnce(
          new HTTPError('Not Found', {
            data: {},
            status: 400,
          }),
        )
      await expect(executeWithPolling<string>('args', polling, singleClientCall)).rejects.toThrow()
    })
    it('should throw an error if polling fails with a non retryStatus', async () => {
      const singleClientCall = jest
        .fn()
        .mockRejectedValueOnce(
          new HTTPError('Not Found', {
            data: {},
            status: 404,
          }),
        )
        .mockResolvedValueOnce({
          data: 'done polling',
          status: 200,
        })
      await expect(executeWithPolling<string>('args', polling, singleClientCall)).rejects.toThrow()
    })
  })
})
