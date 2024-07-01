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
import PQueue from 'p-queue'
import { RATE_LIMIT_DEFAULT_DELAY_PER_REQUEST_MS } from './constants'

/**
 * Type for specifying options for the RateLimiter.
 */
export type RateLimiterOptions = {
  /**
   * The maximum number of concurrent calls allowed.
   * If set to 0 or a negative number, it will be treated as Infinity.
   * @default Infinity
   */
  maxConcurrentCalls: number

  /**
   * The maximum number of calls allowed per interval.
   * If set to 0 or a negative number, it will be treated as Infinity.
   * If intervalLengthMS is set to 0, this must be set to Infinity.
   * If set to a finite positive number, intervalLengthMS must be set to one as well.
   * @default Infinity
   */
  maxCallsPerInterval: number

  /**
   * The length of the interval in milliseconds.
   * If set to a negative number, it will be treated as 0.
   * If maxCallsPerInterval is Infinity, this must be set to 0.
   * If set to a finite positive number, maxCallsPerInterval must be set to one as well.
   * @default 0
   */
  intervalLengthMS: number

  /**
   * Whether running calls should be carried over into the next interval.
   * @default true
   */
  carryRunningCallsOver: boolean

  /**
   * The delay in milliseconds before a task is processed.
   * If set to 0 or a negative number, it will be treated as 0.
   * @default RATE_LIMIT_DEFAULT_DELAY_PER_REQUEST_MS
   */
  delayMS: number

  /**
   * Whether the queue should start in a paused state.
   * @default false
   */
  startPaused: boolean
}

/**
 * Type for tracking the number of total, running, pending, and done tasks.
 */
export type RateLimiterCounters = {
  total: number
  running: number
  pending: number
  done: number
}

/**
 * Validates the given value and returns either the value itself or a default value if the input is invalid.
 * A valid value is a positive number greater than 0.
 * @param defaultValue The default value to return if the input is invalid.
 * @param value The value to be validated.
 * @returns The validated number or the default value.
 */
const validateNumber = (defaultValue: number, value?: number): number =>
  value === undefined || value <= 0 ? defaultValue : value

/**
 * Class for managing rate limiting of tasks using PQueue.
 */
export class RateLimiter {
  private queue: PQueue
  private options: RateLimiterOptions
  private counters: RateLimiterCounters
  private prevInvocationTime: number

  /**
   * Constructs a RateLimiter instance.
   * @param options Configuration options for the rate limiter.
   */
  constructor(options: Partial<RateLimiterOptions> = {}) {
    const maxCallsPerInterval = validateNumber(Infinity, options.maxCallsPerInterval)
    const intervalLengthMS = validateNumber(0, options.intervalLengthMS)
    const delayMS = options.delayMS ?? RATE_LIMIT_DEFAULT_DELAY_PER_REQUEST_MS
    if (
      (maxCallsPerInterval !== Infinity && intervalLengthMS === 0) ||
      (maxCallsPerInterval === Infinity && intervalLengthMS !== 0)
    ) {
      throw new Error(
        'When setting either maxCallsPerInterval or intervalLengthMS to a valid finite number bigger than 0, the other must be set as well.',
      )
    }

    this.options = {
      maxConcurrentCalls: validateNumber(Infinity, options.maxConcurrentCalls),
      maxCallsPerInterval,
      intervalLengthMS,
      carryRunningCallsOver: options.carryRunningCallsOver ?? true,
      delayMS: validateNumber(0, delayMS),
      startPaused: options.startPaused ?? false,
    }

    this.queue = new PQueue({
      concurrency: this.options.maxConcurrentCalls,
      intervalCap: this.options.maxCallsPerInterval,
      interval: this.options.intervalLengthMS,
      carryoverConcurrencyCount: this.options.carryRunningCallsOver,
      autoStart: !this.options.startPaused,
    })

    this.counters = {
      total: 0,
      running: 0,
      pending: 0,
      done: 0,
    }
    this.prevInvocationTime = Date.now()
  }

  /**
   * Returns a copy of the current configuration options of the rate limiter.
   * @returns The current configuration options.
   */
  getOptions(): RateLimiterOptions {
    return { ...this.options }
  }

  /**
   * Calculates the delay required to maintain the configured delay between task invocations.
   * It ensures that tasks are spaced out by at least the delay specified in the options.
   * @returns The calculated delay in milliseconds.
   */
  private nextDelay(): number {
    const currTime = Date.now()
    const timeSinceLastTask = currTime - this.prevInvocationTime
    const delay = Math.max(0, this.options.delayMS - timeSinceLastTask)
    this.prevInvocationTime = currTime + delay

    return delay
  }

  /**
   * Wraps a given task with a delay, ensuring that there is a pause between task invocations.
   * If a delay is specified in the options, it waits for the calculated delay before executing the task.
   * @param task The task to be wrapped and delayed.
   * @returns A function that returns a promise resolving to the result of the task.
   */
  private getDelayedTask<T>(task: () => Promise<T>): () => Promise<T> {
    const delayedTask = async (): Promise<T> => {
      if (this.options.delayMS) {
        await new Promise(resolve => setTimeout(resolve, this.nextDelay()))
      }
      return task()
    }
    return delayedTask
  }

  /**
   * Adds a task to the queue. If a delay is configured in the options,
   * the task will be delayed by the specified amount of milliseconds.
   * @param task The task to be added to the queue.
   * @returns A promise that resolves when the task is completed.
   */
  async add<T>(task: () => Promise<T>): Promise<T> {
    this.counters.total += 1
    return this.queue.add(this.getDelayedTask(task))
  }

  /**
   * Adds multiple tasks to the queue.
   * @param tasks The tasks to be added to the queue.
   * @returns A promise that resolves when all tasks are completed.
   */
  async addAll<T>(tasks: Array<() => Promise<T>>): Promise<T[]> {
    this.counters.total += tasks.length
    const delayedTasks = tasks.map(task => this.getDelayedTask(task))
    return this.queue.addAll(delayedTasks)
  }

  /**
   * Wraps an asynchronous function with the rate limiter.
   * @param fn The asynchronous function to be wrapped.
   * @returns The wrapped function.
   */
  wrap<T extends unknown[], R>(fn: (...args: T) => Promise<R>): (...args: T) => Promise<R> {
    return (...args: T) => this.add(() => fn(...args))
  }

  /**
   * Wraps multiple asynchronous functions with the rate limiter.
   * @param fns The asynchronous functions to be wrapped.
   * @returns The wrapped functions.
   */
  wrapAll<T extends unknown[], R>(fns: Array<(...args: T) => Promise<R>>): Array<(...args: T) => Promise<R>> {
    return fns.map(fn => this.wrap(fn))
  }

  /**
   * Retrieves the current statistics of the queue.
   * @returns An object containing the total, running, pending, and done task counts.
   */
  getCounters(): RateLimiterCounters {
    return {
      total: this.counters.total,
      running: this.queue.pending,
      pending: this.queue.size,
      done: this.counters.total - this.queue.pending - this.queue.size,
    }
  }

  /**
   * Pauses the processing of tasks in the queue.
   */
  pause(): void {
    this.queue.pause()
  }

  /**
   * Resumes the processing of tasks in the queue.
   */
  resume(): void {
    this.queue.start()
  }

  /**
   * Clears all pending tasks in the queue.
   */
  clear(): void {
    this.queue.clear()
  }
}
