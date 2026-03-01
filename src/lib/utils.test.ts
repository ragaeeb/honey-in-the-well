import { describe, expect, it } from 'vitest';
import { cn, isSafeUrl } from './utils';

describe('cn', () => {
    it('should merge multiple class strings', () => {
        expect(cn('foo', 'bar', 'baz')).toBe('foo bar baz');
    });

    it('should handle single class string', () => {
        expect(cn('foo')).toBe('foo');
    });

    it('should handle empty string', () => {
        expect(cn('')).toBe('');
    });

    it('should filter out undefined values', () => {
        expect(cn('foo', undefined, 'bar')).toBe('foo bar');
    });

    it('should filter out null values', () => {
        expect(cn('foo', null, 'bar')).toBe('foo bar');
    });

    it('should filter out false values', () => {
        expect(cn('foo', false, 'bar')).toBe('foo bar');
    });

    it('should handle conditional expressions', () => {
        const isActive = true;
        expect(cn(isActive && 'active', 'base')).toBe('active base');
    });

    it('should handle arrays of classes', () => {
        expect(cn(['foo', 'bar'])).toBe('foo bar');
    });

    it('should handle object with conditional classes', () => {
        expect(cn({ foo: true, bar: false, baz: true })).toBe('foo baz');
    });

    it('should resolve tailwind conflicts via tailwind-merge', () => {
        expect(cn('p-4', 'p-2')).toBe('p-2');
    });

    it('should resolve tailwind padding conflicts', () => {
        expect(cn('px-4', 'px-6')).toBe('px-6');
    });

    it('should resolve tailwind margin conflicts', () => {
        expect(cn('m-2', 'm-4')).toBe('m-4');
    });

    it('should resolve tailwind text color conflicts', () => {
        expect(cn('text-red-500', 'text-blue-500')).toBe('text-blue-500');
    });

    it('should merge non-conflicting tailwind classes', () => {
        expect(cn('p-4', 'm-2', 'text-red-500')).toBe('p-4 m-2 text-red-500');
    });

    it('should handle mixed inputs with conflicts', () => {
        expect(cn('p-4', undefined, 'p-2', 'm-1')).toBe('p-2 m-1');
    });

    it('should handle empty and falsy inputs', () => {
        expect(cn('', undefined, null, false, 'foo')).toBe('foo');
    });

    it('should handle no arguments', () => {
        expect(cn()).toBe('');
    });

    it('should handle multiple conditional inputs', () => {
        const show = true;
        const hide = false;
        expect(cn('base', show && 'visible', hide && 'hidden')).toBe('base visible');
    });
});

describe('isSafeUrl', () => {
    it('should return true for http URLs', () => {
        expect(isSafeUrl('http://example.com')).toBe(true);
    });

    it('should return true for https URLs', () => {
        expect(isSafeUrl('https://example.com/path')).toBe(true);
    });

    it('should return false for javascript URLs', () => {
        expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    });

    it('should return false for data URLs', () => {
        expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    it('should return false for invalid URLs', () => {
        expect(isSafeUrl('not-a-url')).toBe(false);
    });

    it('should return false for empty string', () => {
        expect(isSafeUrl('')).toBe(false);
    });
});
