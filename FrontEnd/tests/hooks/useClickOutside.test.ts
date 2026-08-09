import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useClickOutside } from '@/src/hooks/useClickOutside';

describe('useClickOutside', () => {
  it('calls the handler on a click outside the ref element', () => {
    const inside = document.createElement('div');
    const outside = document.createElement('div');
    document.body.append(inside, outside);
    const ref = { current: inside };
    const onOutside = vi.fn();

    renderHook(() => useClickOutside(ref, onOutside, true));

    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onOutside).toHaveBeenCalledTimes(1);

    inside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(onOutside).toHaveBeenCalledTimes(1);

    inside.remove();
    outside.remove();
  });

  it('calls the handler on Escape', () => {
    const inside = document.createElement('div');
    document.body.append(inside);
    const onOutside = vi.fn();

    renderHook(() => useClickOutside({ current: inside }, onOutside, true));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(onOutside).toHaveBeenCalledTimes(1);
    inside.remove();
  });

  it('does nothing when inactive', () => {
    const outside = document.createElement('div');
    document.body.append(outside);
    const onOutside = vi.fn();

    renderHook(() => useClickOutside({ current: null }, onOutside, false));
    outside.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(onOutside).not.toHaveBeenCalled();
    outside.remove();
  });
});
