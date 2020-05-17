import { TimerManager } from '@klasa/timer-manager';

import type { EventEmitter } from 'events';

export type EventIteratorFilter<V> = (value: V, collected: V[]) => boolean;

export interface EventIteratorOptions<V> {
	filter?: EventIteratorFilter<V>;
	idle?: number;
}

export abstract class EventIterator<V> implements AsyncIterableIterator<V> {

	public filter: EventIteratorFilter<V>;

	#ended = false;

	#idleTimer?: NodeJS.Timer;

	#queue: V[] = [];

	#collected = 0;

	#limit: number;

	public constructor(public readonly emitter: EventEmitter, public event: string, limit: number, options: EventIteratorOptions<V> = {}) {
		this.#limit = limit;
		this.filter = options.filter ?? ((): boolean => true);

		this.push = this.push.bind(this);
		this.emitter.on(this.event, this.push);
		if (options.idle) this.#idleTimer = TimerManager.setTimeout(this.end.bind(this), options.idle);
	}

	public get ended(): boolean {
		return this.#ended;
	}

	public end(): void {
		if (this.#ended) return;
		this.#ended = true;
		this.emitter.off(this.event, this.push);
	}

	public async next(): Promise<IteratorResult<V>> {
		if (this.#queue.length) return { done: false, value: this.#queue.shift() as V };
		if (this.ended) return { done: true, value: undefined as never };
		return new Promise<IteratorResult<V>>((resolve): void => {
			this.emitter.once(this.event, (): void => {
				resolve(this.next());
			});
		});
	}

	public [Symbol.asyncIterator](): AsyncIterableIterator<V> {
		return this;
	}

	protected push(value: V): void {
		if (this.filter(value, this.#queue.slice())) {
			if (++this.#collected >= this.#limit) {
				this.end();
				return;
			}
			// eslint-disable-next-line no-unused-expressions
			this.#idleTimer?.refresh();
			this.#queue.push(value);
		}
	}

}
