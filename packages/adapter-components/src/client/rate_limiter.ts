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
import Bottleneck from 'bottleneck'
import {
  RATE_LIMIT_DEFAULT_CALCULATE_RETRY_DELAY,
  RATE_LIMIT_DEFAULT_CARRY_RUNNING_CALLS_OVER,
  RATE_LIMIT_DEFAULT_DELAY_PER_REQUEST_MS,
  RATE_LIMIT_DEFAULT_INTERVAL_LENGTH_MS,
  RATE_LIMIT_DEFAULT_MAX_CALLS_PER_INTERVAL,
  RATE_LIMIT_DEFAULT_MAX_CONCURRENT_CALLS,
  RATE_LIMIT_DEFAULT_PAUSE_DURING_RETRY_DELAY,
  RATE_LIMIT_DEFAULT_SHOULD_RETRY,
  RATE_LIMIT_DEFAULT_START_PAUSED,
  RATE_LIMIT_DEFAULT_USE_BOTTLENECK,
} from './constants'

type TaskReturnType<T> = Promise<T>
type TaskType<T> = () => TaskReturnType<T>

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

  /**
   * Whether the underlying queue is Bottleneck or PQueue
   * @default true
   */
  useBottleneck: boolean

  /**
   * Predicate to determine if a task should be retried based on the number of attempts and the error encountered.
   * @param attempt The current attempt number.
   * @param error The error encountered during the task execution.
   * @returns A boolean indicating whether the task should be retried.
   * @default () => false
   */
  retryPredicate: (attempt: number, error: Error) => boolean

  /**
   * Function to calculate the delay before retrying a task based on the number of attempts and the error encountered.
   * @param attempt The current attempt number.
   * @param error The error encountered during the task execution.
   * @returns The delay in milliseconds before the next retry.
   * @default () => 0
   */
  calculateRetryDelayMS: (attempt: number, error: Error) => number

  /**
   * Flag indicating whether to pause the queue for the delay calculated.
   * @default false
   */
  pauseDuringRetryDelay: boolean
}

/**
 * Type for tracking the number of total, running, pending, and done tasks.
 */
export type RateLimiterCounters = {
  total: number
  running: number
  pending: number
  done: number
  succeeded: number
  failed: number
  retries: number
}

const toValidNumber = (defaultValue: number, value?: number): number =>
  value === undefined || value <= 0 ? defaultValue : value

/**
 * Class for managing rate limiting of tasks using PQueue or Bottleneck.
 */
export class RateLimiter {
  private queue: PQueue | Bottleneck
  private internalOptions: RateLimiterOptions
  private internalCounters: RateLimiterCounters
  private prevInvocationTime: number
  private resumeTime: number

  /**
   * Constructs a RateLimiter instance.
   * @param options Configuration options for the rate limiter.
   */
  constructor(options: Partial<RateLimiterOptions> = {}) {
    const maxCallsPerInterval = toValidNumber(RATE_LIMIT_DEFAULT_MAX_CALLS_PER_INTERVAL, options.maxCallsPerInterval)
    const intervalLengthMS = toValidNumber(RATE_LIMIT_DEFAULT_INTERVAL_LENGTH_MS, options.intervalLengthMS)

    if (
      (maxCallsPerInterval !== Infinity && intervalLengthMS === 0) ||
      (maxCallsPerInterval === Infinity && intervalLengthMS !== 0)
    ) {
      throw new Error(
        'When setting either maxCallsPerInterval or intervalLengthMS to a valid finite number bigger than 0, the other must be set as well.',
      )
    }

    this.internalOptions = {
      maxConcurrentCalls: toValidNumber(RATE_LIMIT_DEFAULT_MAX_CONCURRENT_CALLS, options.maxConcurrentCalls),
      maxCallsPerInterval,
      intervalLengthMS,
      carryRunningCallsOver: options.carryRunningCallsOver ?? RATE_LIMIT_DEFAULT_CARRY_RUNNING_CALLS_OVER,
      delayMS: toValidNumber(RATE_LIMIT_DEFAULT_DELAY_PER_REQUEST_MS, options.delayMS),
      startPaused: options.startPaused ?? RATE_LIMIT_DEFAULT_START_PAUSED,
      useBottleneck: options.useBottleneck ?? RATE_LIMIT_DEFAULT_USE_BOTTLENECK,
      retryPredicate: options.retryPredicate ?? RATE_LIMIT_DEFAULT_SHOULD_RETRY,
      calculateRetryDelayMS: options.calculateRetryDelayMS ?? RATE_LIMIT_DEFAULT_CALCULATE_RETRY_DELAY,
      pauseDuringRetryDelay: options.pauseDuringRetryDelay ?? RATE_LIMIT_DEFAULT_PAUSE_DURING_RETRY_DELAY,
    }

    if (
      this.internalOptions.useBottleneck &&
      (this.internalOptions.startPaused || this.internalOptions.pauseDuringRetryDelay)
    ) {
      throw new Error(
        "Bottleneck queue can't be paused and thus can't be initialized with startPaused==true or pauseDuringDelay==true.",
      )
    }
    this.queue = this.internalOptions.useBottleneck
      ? new Bottleneck({
          maxConcurrent:
            this.internalOptions.maxConcurrentCalls === Infinity ? null : this.internalOptions.maxConcurrentCalls,
          reservoir:
            this.internalOptions.maxCallsPerInterval === Infinity ? null : this.internalOptions.maxCallsPerInterval,
          reservoirRefreshInterval:
            this.internalOptions.intervalLengthMS === 0 ? null : this.internalOptions.intervalLengthMS,
          reservoirRefreshAmount:
            this.internalOptions.maxCallsPerInterval === Infinity ? null : this.internalOptions.maxCallsPerInterval,
        })
      : new PQueue({
          concurrency: this.internalOptions.maxConcurrentCalls,
          intervalCap: this.internalOptions.maxCallsPerInterval,
          interval: this.internalOptions.intervalLengthMS,
          carryoverConcurrencyCount: this.internalOptions.carryRunningCallsOver,
          autoStart: !this.internalOptions.startPaused,
        })

    this.internalCounters = {
      total: 0,
      running: 0,
      pending: 0,
      done: 0,
      succeeded: 0,
      failed: 0,
      retries: 0,
    }
    this.prevInvocationTime = Date.now()
    this.resumeTime = Date.now()
  }

  /**
   * Returns a copy of the current configuration options of the rate limiter.
   * @returns The current configuration options.
   */
  get options(): RateLimiterOptions {
    return { ...this.internalOptions }
  }

  /**
   * Calculates the delay required to maintain the configured delay between task invocations.
   * It ensures that tasks are spaced out by at least the delay specified in the options.
   * @returns The calculated delay in milliseconds.
   */
  private nextDelay(): number {
    const currTime = Date.now()
    const timeSinceLastTask = currTime - this.prevInvocationTime
    const delay = Math.max(0, this.internalOptions.delayMS - timeSinceLastTask)
    this.prevInvocationTime = currTime + delay

    return delay
  }

  /**
   * Wraps a given task with a delay, ensuring that there is a pause between task invocations.
   * If a delay is specified in the options, it waits for the calculated delay before executing the task.
   * @param task The task to be wrapped and delayed.
   * @returns A function that returns a promise resolving to the result of the task.
   */
  private getDelayedTask<T>(task: TaskType<T>): TaskType<T> {
    const delayedTask = async (): Promise<T> => {
      if (this.internalOptions.delayMS > 0) {
        await new Promise(resolve => setTimeout(resolve, this.nextDelay()))
      }
      return task()
    }
    return delayedTask
  }

  /**
   * Wraps a given task with counters bookkeeping.
   * @param task The task to be wrapped with bookkeeping.
   * @returns A function that returns a promise resolving to the result of the task.
   */
  private wrapWithBookKeeping<T>(task: TaskType<T>, isRetry: boolean = false): TaskType<T> {
    return async (): Promise<T> => {
      this.internalCounters.pending -= 1
      this.internalCounters.running += 1
      if (isRetry) {
        this.internalCounters.retries += 1
      }
      let res
      try {
        res = await task()
        this.internalCounters.succeeded += 1
        return res
      } catch (e) {
        this.internalCounters.failed += 1
        throw e
      } finally {
        this.internalCounters.running -= 1
        this.internalCounters.done += 1
      }
    }
  }

  /**
   * Adds a task to the queue. If a delay is configured in the options,
   * the task will be delayed by the specified amount of milliseconds.
   * @param task The task to be added to the queue.
   * @returns A promise that resolves when the task is completed.
   */
  async add<T>(task: TaskType<T>): TaskReturnType<T> {
    let res: Promise<T>
    let numAttempts = 0
    while (true) {
      this.internalCounters.total += 1
      this.internalCounters.pending += 1
      numAttempts += 1
      const wrappedTask = this.wrapWithBookKeeping(this.getDelayedTask(task), numAttempts > 1)
      try {
        res = this.internalOptions.useBottleneck
          ? (this.queue as Bottleneck).schedule(wrappedTask)
          : (this.queue as PQueue).add(wrappedTask)
        // eslint-disable-next-line no-await-in-loop
        return await res
      } catch (e) {
        if (!this.internalOptions.retryPredicate(numAttempts, e)) {
          throw e
        }
        const delay = this.internalOptions.calculateRetryDelayMS(numAttempts, e)
        if (delay > 0) {
          if (this.internalOptions.pauseDuringRetryDelay) {
            this.pause(delay)
          } else {
            // eslint-disable-next-line no-await-in-loop
            await new Promise(resolve => setTimeout(resolve, delay))
          }
        }
      }
    }
  }

  /**
   * Adds multiple tasks to the queue.
   * @param tasks The tasks to be added to the queue.
   * @returns A promise that resolves when all tasks are completed.
   */
  addAll<T>(tasks: Array<TaskType<T>>): TaskReturnType<T>[] {
    return tasks.map(task => this.add(task))
  }

  /**
   * Wraps an asynchronous function with the rate limiter.
   * @param fn The asynchronous function to be wrapped.
   * @returns The wrapped function.
   */
  wrap<T extends unknown[], R>(fn: (...args: T) => TaskReturnType<R>): (...args: T) => TaskReturnType<R> {
    return (...args: T) => this.add(() => fn(...args))
  }

  /**
   * Wraps multiple asynchronous functions with the rate limiter.
   * @param fns The asynchronous functions to be wrapped.
   * @returns The wrapped functions.
   */
  wrapAll<T extends unknown[], R>(fns: Array<(...args: T) => TaskReturnType<R>>): Array<(...args: T) => TaskReturnType<R>> {
    return fns.map(fn => this.wrap(fn))
  }

  /**
   * Retrieves the current statistics of the queue.
   * @returns An object containing the total, running, pending, and done task counts.
   */
  get counters(): RateLimiterCounters {
    return {
      ...this.internalCounters,
    }
  }

  /**
   * Pauses the processing of tasks in the queue.
   */
  pause(time?: number): void {
    if (this.queue instanceof Bottleneck) {
      throw new Error('RateLimiter has no implementation for pause when the underlying queue is Bottleneck')
    }
    this.queue.pause()
    if (time !== undefined) {
      this.resumeTime = Date.now() + time
      setTimeout(() => {
        if (Date.now() >= this.resumeTime) {
          this.resume()
        }
      }, time)
    }
  }

  /**
   * Resumes the processing of tasks in the queue.
   */
  resume(): void {
    if (this.queue instanceof Bottleneck) {
      throw new Error('RateLimiter has no implementation for resume when the underlying queue is Bottleneck')
    }
    this.queue.start()
  }

  /**
   * Clears all pending tasks in the queue.
   */
  clear(): void {
    if (this.queue instanceof Bottleneck) {
      throw new Error('RateLimiter has no implementation for clear when the underlying queue is Bottleneck')
    }
    this.queue.clear()
    this.internalCounters.total -= this.internalCounters.pending
    this.internalCounters.pending = 0
  }
}
