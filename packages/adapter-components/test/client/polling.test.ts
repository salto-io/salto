/*
 *                      Copyright 2024 Salto Labs Ltd.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { executeWithPolling, Response, ResponseValue } from '../../src/client'

describe('polling', () => {
  describe('executeWithPolling', () => {
    const polling = {
      checkStatus: (response: Response<ResponseValue | ResponseValue[]>): boolean => response.status === 200,
      retries: 3,
      interval: 100,
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
  })
})
