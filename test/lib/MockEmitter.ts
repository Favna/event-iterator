import { EventEmitter } from 'events';
import { EventIterator, EventIteratorOptions } from '../../src';
import { Person } from './Person';
import { TimerManager } from '@klasa/timer-manager';
import { promisify } from 'util';

export class PeopleIterator extends EventIterator<[Person]> { }

export const people = [
	new Person('Anna'),
	new Person('Bob'),
	new Person('Joe')
];

export class PeopleEmitter extends EventEmitter {

	#people = people;

	#emitted = 0;

	#timeout: NodeJS.Timeout | null = null;

	#iterator: PeopleIterator | null = null;

	public init(): void {
		this.#timeout = TimerManager.setInterval((): void => {
			if (this.#emitted === this.#people.length) {
				TimerManager.clearInterval(this.#timeout as NodeJS.Timeout);
				this.#timeout = null;
				// eslint-disable-next-line no-unused-expressions
				this.#iterator?.end();
				this.#iterator = null;
			} else {
				// eslint-disable-next-line no-unused-expressions
				this.emit('testEvent', this.#people[this.#emitted++]);
			}
		}, 1000);
	}

	public createPeopleIterator(options?: EventIteratorOptions<[Person]>): PeopleIterator {
		this.#iterator = new PeopleIterator(this, 'testEvent', options);
		this.init();
		return this.#iterator;
	}

}

export const sleep = promisify(setTimeout);
