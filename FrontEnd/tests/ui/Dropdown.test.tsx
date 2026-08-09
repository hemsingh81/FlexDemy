import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Dropdown } from '@/src/ui/Dropdown';

describe('Dropdown', () => {
  it('starts closed (opacity-0) and opens (opacity-100) when the trigger is clicked', async () => {
    const user = userEvent.setup();
    render(
      <Dropdown
        trigger={({ toggle }) => <button onClick={toggle}>Open</button>}
        menu={() => <div>Menu content</div>}
      />
    );

    const menu = screen.getByText('Menu content').parentElement;
    expect(menu?.className).toMatch(/opacity-0/);

    await user.click(screen.getByText('Open'));
    expect(menu?.className).toMatch(/opacity-100/);
  });

  it('closes when clicking outside', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <div data-testid="outside">Outside</div>
        <Dropdown
          trigger={({ toggle }) => <button onClick={toggle}>Open</button>}
          menu={() => <div>Menu content</div>}
        />
      </div>
    );

    await user.click(screen.getByText('Open'));
    const menu = screen.getByText('Menu content').parentElement;
    expect(menu?.className).toMatch(/opacity-100/);

    await user.click(screen.getByTestId('outside'));
    expect(menu?.className).toMatch(/opacity-0/);
  });

  it('gives menu items a close() callback that dismisses the dropdown', async () => {
    const onSelect = vi.fn();
    const user = userEvent.setup();
    render(
      <Dropdown
        trigger={({ toggle }) => <button onClick={toggle}>Open</button>}
        menu={({ close }) => (
          <button
            onClick={() => {
              onSelect();
              close();
            }}
          >
            Pick me
          </button>
        )}
      />
    );

    await user.click(screen.getByText('Open'));
    const menu = screen.getByText('Pick me').parentElement;
    expect(menu?.className).toMatch(/opacity-100/);

    await user.click(screen.getByText('Pick me'));
    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(menu?.className).toMatch(/opacity-0/);
  });

  it('applies menuProps (e.g. role="listbox") to the same element carrying the transition classes', async () => {
    const user = userEvent.setup();
    render(
      <Dropdown
        trigger={({ toggle }) => <button onClick={toggle}>Open</button>}
        menuProps={{ role: 'listbox' }}
        menu={() => (
          <button role="option" aria-selected={false}>
            Item
          </button>
        )}
      />
    );

    await user.click(screen.getByText('Open'));
    const listbox = screen.getByRole('option', { name: 'Item' }).closest('[role="listbox"]');
    expect(listbox).not.toBeNull();
    expect(listbox?.className).toMatch(/opacity-100/);
  });

  it('positions the menu according to align/side (left/right, top/bottom)', () => {
    const { rerender } = render(
      <Dropdown
        align="left"
        side="bottom"
        trigger={() => <button>Open</button>}
        menu={() => <div>Menu</div>}
      />
    );
    expect(screen.getByText('Menu').parentElement?.className).toMatch(/left-0/);
    expect(screen.getByText('Menu').parentElement?.className).toMatch(/origin-top-left/);

    rerender(
      <Dropdown
        align="right"
        side="top"
        trigger={() => <button>Open</button>}
        menu={() => <div>Menu</div>}
      />
    );
    expect(screen.getByText('Menu').parentElement?.className).toMatch(/right-0/);
    expect(screen.getByText('Menu').parentElement?.className).toMatch(/origin-bottom-right/);
  });
});
