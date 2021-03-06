import { TimerManager } from '@klasa/timer-manager';

import type { EventEmitter } from 'events';

/**
 * A filter for an EventIterator.
 */
export type EventIteratorFilter<V> = (value: V) => boolean;

/**
 * Options to be passed to an EventIterator.
 */
export interface EventIteratorOptions<V> {
	/**
	 * The filter.
	 */
	filter?: EventIteratorFilter<V>;
	/**
	 * The timeout in ms before ending the EventIterator.
	 */
	idle?: number;
	/**
	 * The limit of events that pass the filter to iterate.
	 */
	limit?: number;
}

/**
 * An EventIterator, used for asynchronously iterating over received values.
 */
export class EventIterator<V extends unknown[]> implements AsyncIterableIterator<V> {

	/**
	 * The filter used to filter out values.
	 */
	public filter: EventIteratorFilter<V>;

	/**
	 * Whether or not the EventIterator has ended.
	 */
	#ended = false;

	/**
	 * The amount of idle time in ms before moving on.
	 */
	#idle?: number;

	/**
	 * The queue of received values.
	 */
	#queue: V[] = [];

	/**
	 * The amount of events that have passed the filter.
	 */
	#passed = 0;

	/**
	 * The limit before ending the EventIterator.
	 */
	#limit: number;

	/**
	 * @param emitter The EventEmitter to listen to.
	 * @param event The event we're listening for to receives values from.
	 * @param limit The amount of values to receive before ending the iterator.
	 * @param options Any extra options.
	 */
	public constructor(public readonly emitter: EventEmitter, public event: string, options: EventIteratorOptions<V> = {}) {
		this.#limit = options.limit ?? Infinity;
		this.#idle = options.idle;
		this.filter = options.filter ?? ((): boolean => true);

		this.push = this.push.bind(this);
		const maxListeners = this.emitter.getMaxListeners();
		if (maxListeners !== 0) this.emitter.setMaxListeners(maxListeners + 1);
		this.emitter.on(this.event, this.push);
	}

	/**
	 * Whether or not the EventIterator has ended.
	 */
	public get ended(): boolean {
		return this.#ended;
	}

	/**
	 * Ends the EventIterator.
	 */
	public end(): void {
		if (this.#ended) return;
		this.#ended = true;
		this.#queue = [];
		this.emitter.off(this.event, this.push);
		const maxListeners = this.emitter.getMaxListeners();
		if (maxListeners !== 0) this.emitter.setMaxListeners(maxListeners - 1);
	}

	/**
	 * The next value that's received from the EventEmitter.
	 */
	public async next(): Promise<IteratorResult<V>> {
		if (this.#queue.length) {
			const value = this.#queue.shift();
			if (!this.filter(value)) return this.next();
			if (++this.#passed >= this.#limit) this.end();
			return { done: false, value };
		}
		if (this.#ended) return { done: true, value: undefined as never };
		return new Promise<IteratorResult<V>>((resolve): void => {
			let idleTimer: NodeJS.Timer;

			if (this.#idle) {
				idleTimer = TimerManager.setTimeout(() => {
					this.end();
					resolve(this.next());
				}, this.#idle);
			}

			this.emitter.once(this.event, (): void => {
				if (idleTimer) TimerManager.clearTimeout(idleTimer);
				resolve(this.next());
			});
		});
	}

	/**
	 * Handles what happens when you break or return from a loop.
	 */
	public async return(): Promise<IteratorResult<V>> {
		this.end();
		return { done: true, value: undefined as never };
	}

	/**
	 * Handles what happens when you encounter an error in a loop.
	 */
	public async throw(): Promise<IteratorResult<V>> {
		this.end();
		return { done: true, value: undefined as never };
	}

	/**
	 * The symbol allowing EventIterators to be used in for-await-of loops.
	 */
	public [Symbol.asyncIterator](): AsyncIterableIterator<V> {
		return this;
	}

	/**
	 * Pushes a value into the queue.
	 */
	protected push(...value: V): void {
		this.#queue.push(value);
	}

}
